// fanart.js - fanart 호출 제거, 오류 없이 유지
async function getImages(kitsuId) {
  // 항상 기본값 반환
  return {
    poster: null,
    background: null,
    thumbnail: null,
    logo: '' // 로고도 항상 빈 문자열
  };
}

async function getTvdbId(mappingInfo) {
  // 호출 없이 null 반환
  return null;
}

module.exports = { getImages, getTvdbId };
