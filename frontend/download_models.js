const fs = require('fs');
const path = require('path');
const https = require('https');

const modelsDir = path.join(__dirname, 'public', 'models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

const files = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1'
];

const baseUrl = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

files.forEach(file => {
  const dest = path.join(modelsDir, file);
  https.get(baseUrl + file, (response) => {
    response.pipe(fs.createWriteStream(dest));
    console.log(`Downloaded ${file}`);
  }).on('error', (err) => {
    console.error(`Error downloading ${file}: ${err.message}`);
  });
});
