function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && !Array.isArray(source[key]) && key in target) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function ipMatches(clientIP, pattern) {
  const ip = clientIP.replace(/^::ffff:/, '');

  if (ip === '127.0.0.1' || ip === '::1' || clientIP === '::1') {
    return true;
  }
  if (ip === pattern) {
    return true;
  }
  if (pattern.endsWith('/24')) {
    const subnet = pattern.replace('/24', '').split('.').slice(0, 3).join('.');
    const ipPrefix = ip.split('.').slice(0, 3).join('.');
    return subnet === ipPrefix;
  }
  return false;
}

module.exports = { shuffleArray, deepMerge, ipMatches };
