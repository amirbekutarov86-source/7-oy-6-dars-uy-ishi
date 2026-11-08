const fs = require('fs')
const path = require('path')
const config = require('../utils/config')

const file_path = (file_name) => path.join(config.dataDir, file_name)

const read_file = (file_name) => {
  try {
    const data = JSON.parse(fs.readFileSync(file_path(file_name), 'utf-8'))
    return Array.isArray(data) ? data : []
  } catch (err) {
    if (err.code === 'ENOENT') return []
   
    throw new Error(`${file_name} faylini o'qib bo'lmadi: ${err.message}`)
  }
}


const write_file = (file_name, data) => {
  fs.mkdirSync(config.dataDir, { recursive: true })
  const tmp = file_path(file_name) + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file_path(file_name))
}

const next_id = (items) => (items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1)

module.exports = { read_file, write_file, next_id }
