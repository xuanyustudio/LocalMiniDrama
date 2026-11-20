export function isSupportedVideoDuration(seconds, limits) {
  return !limits || (Number.isInteger(seconds) && seconds >= limits.minSeconds && seconds <= limits.maxSeconds)
}
