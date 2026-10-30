/**
 * 整集合并后的后处理：对白 TTS 轨、解说旁白轨+SRT、右下角文字水印（可组合）。
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { getFfmpegPath, getFfprobePath } = require('../utils/ffmpegPath');

function ffprobeDurationSec(filePath) {
  const probe = getFfprobePath();
  const r = spawnSync(
    probe,
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  if (r.status !== 0) return null;
  const d = parseFloat(String(r.stdout || '').trim());
  return Number.isFinite(d) && d > 0 ? d : null;
}

function formatSrtTimestamp(ms) {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const z = Math.floor(ms % 1000);
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(h)}:${p2(m)}:${p2(s)},${String(z).padStart(3, '0')}`;
}

function buildAtempoChain(factor) {
  if (!Number.isFinite(factor) || factor <= 0) return null;
  if (Math.abs(factor - 1) < 0.002) return null;
  const parts = [];
  let f = factor;
  while (f > 2.001) {
    parts.push('atempo=2');
    f /= 2;
  }
  while (f < 0.499) {
    parts.push('atempo=0.5');
    f /= 0.5;
  }
  parts.push(`atempo=${Math.min(2, Math.max(0.5, f))}`);
  return parts.join(',');
}

function escapeFfmpegPath(absPath) {
  let s = path.resolve(absPath).replace(/\\/g, '/');
  if (/^[A-Za-z]:/.test(s)) s = s.replace(/^([A-Za-z]):/, '$1\\:');
  return s.replace(/'/g, "\\'");
}

function runFfmpeg(args, log, tag) {
  const bin = getFfmpegPath();
  const r = spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error) {
    log.warn('merged post: ffmpeg spawn', { tag, error: r.error.message });
    return false;
  }
  if (r.status !== 0) {
    log.warn('merged post: ffmpeg failed', { tag, stderr: r.stderr?.slice(-1000) });
    return false;
  }
  return true;
}

function writeSilenceMp3(slotSec, outPath, log) {
  return runFfmpeg(
    ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(slotSec), '-c:a', 'libmp3lame', '-q:a', '6', outPath],
    log,
    'silence'
  );
}

function fitAudioToSlot(inputPath, slotSec, outPath, log) {
  const d = ffprobeDurationSec(inputPath);
  if (d == null || d <= 0.01) return false;
  const eps = 0.06;
  if (d > slotSec + eps) {
    const factor = d / slotSec;
    const chain = buildAtempoChain(factor);
    const af = chain || 'anull';
    return runFfmpeg(
      ['-y', '-i', inputPath, '-af', af, '-t', String(slotSec), '-c:a', 'libmp3lame', '-q:a', '4', outPath],
      log,
      'fit_speed'
    );
  }
  if (d < slotSec - eps) {
    const pad = slotSec - d;
    return runFfmpeg(
      ['-y', '-i', inputPath, '-af', `apad=pad_dur=${pad}`, '-t', String(slotSec), '-c:a', 'libmp3lame', '-q:a', '4', outPath],
      log,
      'fit_pad'
    );
  }
  try {
    fs.copyFileSync(inputPath, outPath);
    return true;
  } catch (_) {
    return runFfmpeg(
      ['-y', '-i', inputPath, '-t', String(slotSec), '-c:a', 'libmp3lame', '-q:a', '4', outPath],
      log,
      'fit_copy'
    );
  }
}

function concatMp3List(segmentPaths, outPath, log) {
  const listFile = path.join(path.dirname(outPath), `mix_concat_${Date.now()}.txt`);
  try {
    const lines = segmentPaths.map((p) => {
      const normalized = path.resolve(p).replace(/\\/g, '/');
      return `file '${normalized.replace(/'/g, "'\\''")}'`;
    });
    fs.writeFileSync(listFile, lines.join('\n'), 'utf8');
    return runFfmpeg(
      ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'libmp3lame', '-q:a', '4', outPath],
      log,
      'concat_mix'
    );
  } finally {
    try {
      if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
    } catch (_) {}
  }
}

function alignAudioToVideoDuration(inMp3, videoDur, outPath, log) {
  const n = ffprobeDurationSec(inMp3);
  if (n == null || !Number.isFinite(videoDur) || videoDur <= 0.1) return false;
  const eps = 0.08;
  if (n > videoDur + eps) {
    const factor = n / videoDur;
    const chain = buildAtempoChain(factor);
    if (!chain) {
      try {
        fs.copyFileSync(inMp3, outPath);
        return true;
      } catch (_) {
        return false;
      }
    }
    return runFfmpeg(
      ['-y', '-i', inMp3, '-af', chain, '-t', String(videoDur), '-c:a', 'libmp3lame', '-q:a', '4', outPath],
      log,
      'align_speed'
    );
  }
  if (n < videoDur - eps) {
    const pad = videoDur - n;
    return runFfmpeg(
      ['-y', '-i', inMp3, '-af', `apad=pad_dur=${pad}`, '-t', String(videoDur), '-c:a', 'libmp3lame', '-q:a', '4', outPath],
      log,
      'align_pad'
    );
  }
  try {
    fs.copyFileSync(inMp3, outPath);
    return true;
  } catch (_) {
    return false;
  }
}

function amixTwoTracks(pathA, pathB, slotSec, outPath, log) {
  return runFfmpeg(
    [
      '-y', '-i', pathA, '-i', pathB,
      '-filter_complex', `[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2[aout]`,
      '-map', '[aout]',
      '-t', String(slotSec),
      '-c:a', 'libmp3lame', '-q:a', '4',
      outPath,
    ],
    log,
    'amix_seg'
  );
}

function getDrawtextFontOption() {
  const candidates = [];
  if (process.platform === 'win32') {
    const root = process.env.SystemRoot || 'C:\\Windows';
    candidates.push(
      path.join(root, 'Fonts', 'msyh.ttc'),
      path.join(root, 'Fonts', 'msyhbd.ttc'),
      path.join(root, 'Fonts', 'simhei.ttf')
    );
  }
  candidates.push('/System/Library/Fonts/PingFang.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf');
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      return `:fontfile='${escapeFfmpegPath(p)}'`;
    }
  }
  return '';
}

/**
 * @param {object} mergeOpts — burn_dialogue_audio, burn_narration_subtitles, watermark_text
 */
async function runMergedEpisodePostProcess(db, log, opts) {
  const { mergedAbsPath, storageRoot, scenes, episodeId, mergeOpts = {} } = opts;
  const wantDial = !!mergeOpts.burn_dialogue_audio;
  const wantNarr = !!mergeOpts.burn_narration_subtitles;
  const watermarkText = (mergeOpts.watermark_text && String(mergeOpts.watermark_text).trim())
    ? String(mergeOpts.watermark_text).trim().slice(0, 200)
    : '';

  if (!mergedAbsPath || !fs.existsSync(mergedAbsPath) || !Array.isArray(scenes) || scenes.length === 0) {
    return { ok: false, error: '无效合成参数' };
  }

  const needAudio = wantDial || wantNarr;
  if (!needAudio && !watermarkText) {
    return { ok: false, error: 'NO_POST_OPTS' };
  }

  const videoDur = ffprobeDurationSec(mergedAbsPath);
  if (videoDur == null) {
    return { ok: false, error: '无法读取合成视频时长' };
  }

  const tempRoot = path.join(require('os').tmpdir(), 'drama-merged-post', String(episodeId || 0), String(Date.now()));
  fs.mkdirSync(tempRoot, { recursive: true });
  const ttsService = require('./ttsService');

  try {
    let alignedAudioPath = null;
    let srtPath = null;
    let srtLines = [];

    if (needAudio) {
      let tMs = 0;
      let srtIdx = 1;
      const segmentFiles = [];

      for (let i = 0; i < scenes.length; i++) {
        const sc = scenes[i];
        const sbId = Number(sc.scene_id);
        const slotSec = Math.max(0.2, Number(sc.duration) || 5);
        const row = db.prepare(
          'SELECT dialogue, narration, audio_local_path, narration_audio_local_path FROM storyboards WHERE id = ? AND deleted_at IS NULL'
        ).get(sbId);

        const narrText = (row?.narration && String(row.narration).trim()) ? String(row.narration).trim() : '';
        if (wantNarr && narrText) {
          const durMs = Math.round(slotSec * 1000);
          srtLines.push(String(srtIdx++), `${formatSrtTimestamp(tMs)} --> ${formatSrtTimestamp(tMs + durMs)}`, narrText, '');
        }
        tMs += Math.round(slotSec * 1000);

        const diaFit = path.join(tempRoot, `dia_fit_${i}.mp3`);
        const narrFit = path.join(tempRoot, `narr_fit_${i}.mp3`);
        const segOut = path.join(tempRoot, `seg_mix_${i}.mp3`);

        if (wantDial) {
          const rel = row?.audio_local_path && String(row.audio_local_path).trim();
          const srcAbs = rel ? path.join(storageRoot, rel.replace(/\//g, path.sep)) : null;
          if (srcAbs && fs.existsSync(srcAbs)) {
            if (!fitAudioToSlot(srcAbs, slotSec, diaFit, log)) {
              return { ok: false, error: `对白配音时长对齐失败 #${i}` };
            }
          } else if (!writeSilenceMp3(slotSec, diaFit, log)) {
            return { ok: false, error: `对白静音片段失败 #${i}` };
          }
        }

        if (wantNarr) {
          if (!narrText) {
            if (!writeSilenceMp3(slotSec, narrFit, log)) {
              return { ok: false, error: `旁白静音片段失败 #${i}` };
            }
          } else {
            const segRaw = path.join(tempRoot, `narr_raw_${i}.mp3`);
            let synth;
            try {
              synth = await ttsService.synthesize(db, log, {
                text: narrText,
                storyboard_id: null,
                storage_base: storageRoot,
              });
            } catch (e) {
              log.warn('merged post: narration TTS failed', { segment: i, error: e.message });
              return { ok: false, error: `解说旁白 TTS 失败：${e.message}` };
            }
            const narrAbs = path.join(storageRoot, synth.local_path.replace(/\//g, path.sep));
            if (!fs.existsSync(narrAbs)) {
              return { ok: false, error: `旁白 TTS 文件不存在` };
            }
            try {
              fs.copyFileSync(narrAbs, segRaw);
            } catch (_) {
              return { ok: false, error: '复制旁白 TTS 失败' };
            }
            if (!fitAudioToSlot(segRaw, slotSec, narrFit, log)) {
              return { ok: false, error: `旁白时长对齐失败 #${i}` };
            }
          }
        }

        if (wantDial && wantNarr) {
          if (!amixTwoTracks(diaFit, narrFit, slotSec, segOut, log)) {
            return { ok: false, error: `对白与旁白混音失败 #${i}` };
          }
        } else if (wantDial) {
          try {
            fs.copyFileSync(diaFit, segOut);
          } catch (_) {
            return { ok: false, error: `对白片段复制失败 #${i}` };
          }
        } else if (wantNarr) {
          try {
            fs.copyFileSync(narrFit, segOut);
          } catch (_) {
            return { ok: false, error: `旁白片段复制失败 #${i}` };
          }
        }

        segmentFiles.push(segOut);
      }

      const concatOut = path.join(tempRoot, 'full_mix.mp3');
      if (!concatMp3List(segmentFiles, concatOut, log)) {
        return { ok: false, error: '音轨拼接失败' };
      }

      alignedAudioPath = path.join(tempRoot, 'aligned_mix.mp3');
      if (!alignAudioToVideoDuration(concatOut, videoDur, alignedAudioPath, log)) {
        return { ok: false, error: '音轨与视频总时长对齐失败' };
      }

      if (wantNarr && srtLines.length > 0) {
        const baseName = path.basename(mergedAbsPath, path.extname(mergedAbsPath));
        srtPath = path.join(path.dirname(mergedAbsPath), `${baseName}_narration.srt`);
        fs.writeFileSync(srtPath, `\uFEFF${srtLines.join('\n')}\n`, 'utf8');
      }
    }

    const baseName = path.basename(mergedAbsPath, path.extname(mergedAbsPath));
    const outAbs = path.join(path.dirname(mergedAbsPath), `${baseName}_post.mp4`);

    const hasSubs = !!(srtPath && fs.existsSync(srtPath));
    const hasWm = !!watermarkText;

    const vfParts = [];
    if (hasSubs) {
      const subEsc = escapeFfmpegPath(srtPath);
      vfParts.push(`subtitles='${subEsc}':charenc=UTF-8`);
    }
    if (hasWm) {
      const wmFile = path.join(tempRoot, 'watermark.txt');
      fs.writeFileSync(wmFile, watermarkText, 'utf8');
      const wmEsc = escapeFfmpegPath(wmFile);
      const fontOpt = getDrawtextFontOption();
      vfParts.push(
        `drawtext=textfile='${wmEsc}':reload=1${fontOpt}:x=w-tw-16:y=h-th-16:fontsize=22:fontcolor=white@0.82:borderw=2:bordercolor=black@0.55`
      );
    }
    let filterComplex = '';
    if (vfParts.length === 1) {
      filterComplex = `[0:v]${vfParts[0]}[vout]`;
    } else if (vfParts.length === 2) {
      filterComplex = `[0:v]${vfParts[0]}[vx];[vx]${vfParts[1]}[vout]`;
    }

    if (needAudio) {
      if (!alignedAudioPath || !fs.existsSync(alignedAudioPath)) {
        return { ok: false, error: '内部错误：缺少对齐音轨' };
      }
      const args = ['-y', '-i', mergedAbsPath, '-i', alignedAudioPath];
      if (filterComplex) {
        args.push('-filter_complex', filterComplex, '-map', '[vout]', '-map', '1:a');
      } else {
        args.push('-map', '0:v', '-map', '1:a');
      }
      args.push(
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', outAbs
      );
      if (!runFfmpeg(args, log, 'mux_av')) {
        return { ok: false, error: '烧录字幕/水印或混音失败（请确认 ffmpeg 含 libx264）' };
      }
    } else {
      if (!filterComplex) {
        return { ok: false, error: '内部错误：仅水印但无滤镜链' };
      }
      const args = ['-y', '-i', mergedAbsPath, '-filter_complex', filterComplex, '-map', '[vout]'];
      if (ffprobeHasAudio(mergedAbsPath)) {
        args.push('-map', '0:a', '-c:a', 'copy');
      } else {
        args.push('-an');
      }
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-movflags', '+faststart', outAbs);
      if (!runFfmpeg(args, log, 'watermark_only')) {
        return { ok: false, error: '水印烧录失败' };
      }
    }

    if (!fs.existsSync(outAbs)) {
      return { ok: false, error: '输出文件未生成' };
    }

    const relFromRoot = path.relative(storageRoot, outAbs).replace(/\\/g, '/');

    try {
      if (fs.existsSync(mergedAbsPath) && outAbs !== mergedAbsPath) {
        fs.unlinkSync(mergedAbsPath);
      }
    } catch (e) {
      log.warn('merged post: could not remove intermediate', { error: e.message });
    }

    log.info('merged post: done', { episode_id: episodeId, video: relFromRoot });
    return { ok: true, relativePath: relFromRoot };
  } catch (e) {
    log.warn('merged post: exception', { error: e.message });
    return { ok: false, error: e.message || String(e) };
  } finally {
    try {
      for (const p of fs.readdirSync(tempRoot)) {
        try {
          fs.unlinkSync(path.join(tempRoot, p));
        } catch (_) {}
      }
      fs.rmdirSync(tempRoot);
    } catch (_) {}
  }
}

function ffprobeHasAudio(filePath) {
  const probe = getFfprobePath();
  const r = spawnSync(
    probe,
    ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', filePath],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  return r.status === 0 && String(r.stdout || '').trim().length > 0;
}

module.exports = {
  runMergedEpisodePostProcess,
  ffprobeDurationSec,
};
