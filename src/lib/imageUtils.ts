import heic2any from 'heic2any';

export const compressImage = async (file: File, maxWidth = 1024): Promise<File> => {
  if (!file.type.startsWith('image/') && !file.name.toLowerCase().endsWith('.heic') && !file.name.toLowerCase().endsWith('.heif')) {
    return file;
  }
  
  let processFile = file;
  if (file.type === 'image/heic' || file.type === 'image/heif' || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8
      });
      const blobArray = Array.isArray(convertedBlob) ? convertedBlob : [convertedBlob];
      processFile = new File(blobArray, file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
    } catch (err) {
      console.warn("HEIC conversion failed", err);
      return file; // Fallback
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(processFile);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
        const width = img.width * (ratio < 1 ? ratio : 1);
        const height = img.height * (ratio < 1 ? ratio : 1);
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(processFile);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(processFile);
            return;
          }
          const compressedFile = new File([blob], processFile.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, 'image/jpeg', 0.7); // 70% quality JPEG
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
};

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const trimVideo = async (file: File, maxDuration = 45): Promise<File> => {
  // First, check duration without loading FFmpeg if possible
  const video = document.createElement('video');
  video.preload = 'metadata';
  
  const duration = await new Promise<number>((resolve) => {
    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });

  if (duration <= maxDuration) {
    return file;
  }

  console.log(`Trimming video from ${duration}s to ${maxDuration}s`);

  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
  }

  if (!ffmpeg.loaded) {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }

  const inputName = 'input.mp4';
  const outputName = 'output.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  // Trim to maxDuration
  await ffmpeg.exec(['-i', inputName, '-t', maxDuration.toString(), '-c', 'copy', outputName]);
  
  const data = await ffmpeg.readFile(outputName);
  const trimmedBlob = new Blob([data], { type: 'video/mp4' });
  
  return new File([trimmedBlob], file.name, {
    type: 'video/mp4',
    lastModified: Date.now(),
  });
};
