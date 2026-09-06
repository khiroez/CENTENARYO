const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'node_modules', '@vladmandic', 'face-api', 'model');
const destDir = path.join(__dirname, 'public', 'models');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Map of model base names
const models = [
  { manifest: 'tiny_face_detector_model-weights_manifest.json', bin: 'tiny_face_detector_model.bin', weights: 'tiny_face_detector_model.weights' },
  { manifest: 'face_landmark_68_tiny_model-weights_manifest.json', bin: 'face_landmark_68_tiny_model.bin', weights: 'face_landmark_68_tiny_model.weights' },
  { manifest: 'face_recognition_model-weights_manifest.json', bin: 'face_recognition_model.bin', weights: 'face_recognition_model.weights' },
];

console.log('Copying face-api models and configuring .weights bypass for download managers (IDM)...');

models.forEach(({ manifest, bin, weights }) => {
  const srcBin = path.join(srcDir, bin);
  const destWeights = path.join(destDir, weights);
  const destBin = path.join(destDir, bin);
  
  if (fs.existsSync(srcBin)) {
    fs.copyFileSync(srcBin, destWeights);
    fs.copyFileSync(srcBin, destBin);
    console.log(`✓ Copied ${weights} (${Math.round(fs.statSync(destWeights).size / 1024)} KB)`);
  }

  const srcManifest = path.join(srcDir, manifest);
  const destManifest = path.join(destDir, manifest);
  if (fs.existsSync(srcManifest)) {
    let content = fs.readFileSync(srcManifest, 'utf-8');
    // Replace .bin path with .weights to prevent browser download manager interception
    content = content.replace(new RegExp(`"${bin}"`, 'g'), `"${weights}"`);
    fs.writeFileSync(destManifest, content, 'utf-8');
    console.log(`✓ Configured ${manifest} -> ${weights}`);
  }
});

console.log('Model setup completed successfully.');
