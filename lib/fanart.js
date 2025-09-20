const axios = require('axios');
const { xml2js } = require('xml-js')
const FanartTvApi = require("fanart.tv-api");
const urlExists = require("url-exists");
const { cacheWrapImages } = require('./cache');
const { getImdbMapping } = require('./metadataEnrich')
const fanart = new FanartTvApi({ apiKey: process.env.FANART_APIKEY });

async function getImages(kitsuId) {
  const mappingInfo = getImdbMapping(kitsuId);
  if (!mappingInfo || (!mappingInfo.imdb_id && !mappingInfo.tmdb_id && !mappingInfo.tvdb_id)) {
    return {};
  }
  const cacheKey = mappingInfo.tmdb_id || mappingInfo.tvdb_id || mappingInfo.fanartLogoId ? kitsuId : mappingInfo.imdb_id;
  return cacheWrapImages(cacheKey, () => retrieveImages(kitsuId, mappingInfo));
}

function retrieveImages(kitsuId, mappingInfo) {
  return retrieveFanartImages(kitsuId, mappingInfo)
      .catch(() => ({}))
      .then(images => retrieveMetahubImages(mappingInfo.imdb_id, images))
}

function retrieveFanartImages(kitsuId, mappingInfo) {
  return retrieveSeriesImages(kitsuId, mappingInfo)
      .catch(() => retrieveMovieImages(kitsuId, mappingInfo));
}

function retrieveMovieImages(kitsuId, mappingInfo) {
  return fanart.getMovieImages(mappingInfo.tmdb_id || mappingInfo.imdb_id)
      .then(response => ({
        poster: firstUrl(response.movieposter),
        background: firstUrl(response.moviebackground)
      }));
}

function retrieveSeriesImages(kitsuId, mappingInfo) {
  return getTvdbId(mappingInfo)
      .then(tvdbId => fanart.getShowImages(tvdbId))
      .then(response => response.thetvdb_id && response.thetvdb_id !== '0' ? response : {})
      .then(response => ({
          poster: firstUrl(response.tvposter),
          background: firstUrl(response.showbackground),
          thumbnail: thumbnailUrl(mappingInfo, response.seasonthumb, response.tvthumb)
      }));
}

async function retrieveMetahubImages(imdbId, images) {
  if (!images.background) {
    images.background = await checkIfExists(`https://images.metahub.space/background/medium/${imdbId}/img`)
  }
  if (!images.poster) {
    images.poster = await checkIfExists(`https://images.metahub.space/poster/small/${imdbId}/img`)
  }
  return images
}

async function getTvdbId(mappingInfo) {
  if (mappingInfo.tvdb_id) {
    return mappingInfo.tvdb_id;
  }

  const url =`https://thetvdb.com/api/GetSeriesByRemoteID.php?imdbid=${mappingInfo.imdb_id}`;
  const options = { headers: { accept: 'application/xml' } }
  return axios.get(url, options)
      .then(response => xml2js(response.data))
      .then(result => result?.elements[0]?.elements?.map(series => series?.elements[0]?.elements[0]?.text))
      .then(seriesIds => seriesIds?.sort((a, b) => a - b)?.[0])
      .then(tvdbId => tvdbId || Promise.reject("no id found"));
}

async function checkIfExists(imdbImage) {
  return new Promise((resolve) => {
    urlExists(imdbImage, (err, exists) => {
      if (exists) {
        resolve(imdbImage)
      } else {
        resolve(undefined);
      }
    })
  });
}

function thumbnailUrl(mappingInfo, seasonal = [], series = []) {
  const season = `${mappingInfo.fromSeason}`
  const seasonalThumb = firstUrl(seasonal.filter(e => e.season = season))
  return toHttps(seasonalThumb?.url) || firstUrl(series)
}

function firstUrl(array) {
  return toHttps(firstEntry(array)?.url);
}

function firstEntry(array = []) {
  return array.filter(e => !e.lang || ['en', '00'].includes(e.lang))[0] || array[0];
}

function toHttps(url) {
  return url ? url.replace('http://', 'https://') : undefined;
}

module.exports = { getImages, getTvdbId };
