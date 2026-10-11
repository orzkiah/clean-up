import * as fs from 'fs';
import * as crypto from 'crypto';

export interface CandidateFile {
  itemId: string;
  name: string;
  fullPath: string;
  sizeBytes: number;
  createdAt: string;
  modifiedAt: string;
  mtimeMs?: number;
}

const SAMPLE_CHUNK_SIZE = 8192; // 8 KB

export class FingerprintService {
  /**
   * Stage 1: Group files by exact byte size.
   * Unique sizes CANNOT be exact duplicates and are eliminated immediately.
   */
  public groupBySize(files: CandidateFile[]): Map<number, CandidateFile[]> {
    const sizeMap = new Map<number, CandidateFile[]>();

    for (const file of files) {
      // 0-byte files cannot reclaim space and are excluded
      if (file.sizeBytes <= 0) continue;

      const group = sizeMap.get(file.sizeBytes);
      if (group) {
        group.push(file);
      } else {
        sizeMap.set(file.sizeBytes, [file]);
      }
    }

    // Eliminate unique sizes (where count === 1)
    const candidates = new Map<number, CandidateFile[]>();
    for (const [size, group] of sizeMap.entries()) {
      if (group.length > 1) {
        candidates.set(size, group);
      }
    }

    return candidates;
  }

  /**
   * Stage 2: Quick Fingerprint.
   * Reads small deterministic samples (beginning, middle, and end) without
   * loading whole files into memory. Obvious non-duplicates are eliminated fast.
   */
  public async computeQuickFingerprint(
    filePath: string,
    sizeBytes: number
  ): Promise<string | null> {
    let fd: number | null = null;
    try {
      fd = fs.openSync(filePath, 'r');
      const hash = crypto.createHash('sha256');

      if (sizeBytes <= SAMPLE_CHUNK_SIZE * 3) {
        // Small file: read all
        const buf = Buffer.alloc(sizeBytes);
        const bytesRead = fs.readSync(fd, buf, 0, sizeBytes, 0);
        hash.update(buf.subarray(0, bytesRead));
      } else {
        // Sample beginning
        const startBuf = Buffer.alloc(SAMPLE_CHUNK_SIZE);
        const startRead = fs.readSync(fd, startBuf, 0, SAMPLE_CHUNK_SIZE, 0);
        hash.update(startBuf.subarray(0, startRead));

        // Sample middle
        const midOffset = Math.floor((sizeBytes - SAMPLE_CHUNK_SIZE) / 2);
        const midBuf = Buffer.alloc(SAMPLE_CHUNK_SIZE);
        const midRead = fs.readSync(fd, midBuf, 0, SAMPLE_CHUNK_SIZE, midOffset);
        hash.update(midBuf.subarray(0, midRead));

        // Sample end
        const endOffset = sizeBytes - SAMPLE_CHUNK_SIZE;
        const endBuf = Buffer.alloc(SAMPLE_CHUNK_SIZE);
        const endRead = fs.readSync(fd, endBuf, 0, SAMPLE_CHUNK_SIZE, endOffset);
        hash.update(endBuf.subarray(0, endRead));
      }

      return hash.digest('hex');
    } catch {
      // Inaccessible or locked file -> skip
      return null;
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {
          // Ignore close error
        }
      }
    }
  }

  /**
   * Stage 3: Full SHA-256 hash using streaming reads.
   * Multi-gigabyte files are streamed in 64 KB chunks, strictly never
   * loading the entire file into RAM.
   */
  public computeFullHashStream(
    filePath: string,
    signal?: AbortSignal
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        return reject(new Error('Operation aborted'));
      }

      let stream: fs.ReadStream;
      try {
        stream = fs.createReadStream(filePath, { highWaterMark: 64 * 1024 });
      } catch (err) {
        return reject(err);
      }

      const hash = crypto.createHash('sha256');

      const onAbort = () => {
        stream.destroy(new Error('Operation aborted'));
        reject(new Error('Operation aborted'));
      };

      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      stream.on('data', (chunk: string | Buffer) => {
        if (signal?.aborted) {
          stream.destroy();
          if (signal) signal.removeEventListener('abort', onAbort);
          return reject(new Error('Operation aborted'));
        }
        hash.update(chunk);
      });

      stream.on('end', () => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve(hash.digest('hex'));
      });

      stream.on('error', (err) => {
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(err);
      });
    });
  }
}

export const defaultFingerprintService = new FingerprintService();
