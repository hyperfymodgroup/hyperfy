import { createReadStream } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// System files and directories that should be hidden
const HIDDEN_PATHS = [
  'pagefile.sys',
  'hiberfil.sys',
  'swapfile.sys',
  '$Recycle.Bin',
  'System Volume Information'
]

// Resolve and validate path is within allowed directory
function resolveSafePath(requestedPath) {
  const rootDir = process.env.FILES_ROOT || path.join(__dirname, '../../../')
  const resolvedPath = path.resolve(rootDir, requestedPath || '.')
  
  if (!resolvedPath.startsWith(rootDir)) {
    throw new Error('Access denied: Path outside root directory')
  }

  // Check if path contains any hidden system files/directories
  const pathParts = resolvedPath.split(path.sep)
  for (const part of pathParts) {
    if (HIDDEN_PATHS.includes(part)) {
      throw new Error('Access denied: System file or directory')
    }
  }
  
  return resolvedPath
}

// Get file/directory stats in consistent format
async function getFileStats(fullPath) {
  try {
    const stats = await fs.stat(fullPath)
    const name = path.basename(fullPath)

    // Skip hidden files
    if (HIDDEN_PATHS.includes(name)) {
      return null
    }

    return {
      name,
      path: path.relative(process.env.FILES_ROOT || path.join(__dirname, '../../../'), fullPath),
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      modified: stats.mtime
    }
  } catch (err) {
    // Skip files we can't access
    return null
  }
}

export function fileExplorer(socket) {
  // Add file explorer methods to network
  socket.network.onFileList = async (socket, { path: requestedPath }) => {
    try {
      const resolvedPath = resolveSafePath(requestedPath)
      const entries = await fs.readdir(resolvedPath)
      
      const contents = await Promise.all(
        entries.map(async entry => {
          const fullPath = path.join(resolvedPath, entry)
          return await getFileStats(fullPath)
        })
      )

      // Filter out null entries (hidden/inaccessible files)
      const filteredContents = contents.filter(Boolean)

      // Sort directories first, then files alphabetically
      filteredContents.sort((a, b) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name)
        }
        return a.type === 'directory' ? -1 : 1
      })

      socket.send('fileList', { contents: filteredContents })
    } catch (error) {
      socket.send('fileError', { message: error.message })
    }
  }

  socket.network.onFileDownload = async (socket, { path: requestedPath }) => {
    try {
      const resolvedPath = resolveSafePath(requestedPath)
      const stats = await fs.stat(resolvedPath)
      
      if (!stats.isFile()) {
        throw new Error('Not a file')
      }

      // Check file permissions
      try {
        await fs.access(resolvedPath, fs.constants.R_OK)
      } catch (err) {
        throw new Error('Access denied: Cannot read file')
      }

      socket.send('fileDownloadStart', {
        name: path.basename(resolvedPath),
        size: stats.size
      })

      const stream = createReadStream(resolvedPath)

      stream.on('data', (chunk) => {
        socket.send('fileDownloadChunk', chunk)
      })

      stream.on('end', () => {
        socket.send('fileDownloadComplete', null)
      })

      stream.on('error', (error) => {
        socket.send('fileError', { message: error.message })
      })
    } catch (error) {
      socket.send('fileError', { message: error.message })
    }
  }
} 