const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'app', 'seniors', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add autoCheckResults state and face-api model loading
const stateMarker = "const [searchQuery, setSearchQuery] = useState('');";
const newStateStr = `const [searchQuery, setSearchQuery] = useState('');
  const [autoCheckResults, setAutoCheckResults] = useState<any>({});
  
  // Load face-api models on mount
  useEffect(() => {
    const loadFaceApi = async () => {
      try {
        const faceapi = await import('@vladmandic/face-api');
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        console.log("Face-api models loaded successfully.");
      } catch (e) {
        console.error("Failed to load face-api models:", e);
      }
    };
    loadFaceApi();
  }, []);`;

content = content.replace(stateMarker, newStateStr);

// 2. Add auto_check_results to formData submission
const fdMarker = `fd.append('annex_a_data', JSON.stringify(cleanAnnexData));`;
const newFdStr = `fd.append('annex_a_data', JSON.stringify(cleanAnnexData));
      fd.append('auto_check_results', JSON.stringify(autoCheckResults));`;
content = content.replace(fdMarker, newFdStr);

// 3. Update notification message
const notifMarker = `openSuccess(
          isEditMode ? "Record Updated" : "Registration Complete",
          \`The record for \${formData.given_name} \${formData.last_name} has been successfully saved to the registry.\`
        );`;
const newNotifStr = `openSuccess(
          isEditMode ? "Record Updated" : "Registration Submitted for Review",
          \`The record for \${formData.given_name} \${formData.last_name} has been successfully submitted and is pending review.\`
        );`;
content = content.replace(notifMarker, newNotifStr);

// 4. In handleFileChange, update the validation logic
// Finding the runValidation function
const rvMarker = "const runValidation = (imgWidth: number, imgHeight: number, imgElement?: HTMLImageElement) => {";
const rvEndMarker = "}; // end runValidation"; // We won't find this easily, let's use regex or string indexing
const rvIndex = content.indexOf(rvMarker);
const setVerificationStateIndex = content.indexOf("setVerificationState({", rvIndex);
const setVerificationStateEnd = content.indexOf("});", setVerificationStateIndex) + 3;

// We will just rewrite the bottom part of runValidation.
const newValidationEnding = `
                let faceDetected = true;
                let multipleFaces = false;
                
                if (imgElement) {
                  try {
                    const faceapi = await import('@vladmandic/face-api');
                    const detections = await faceapi.detectAllFaces(imgElement, new faceapi.TinyFaceDetectorOptions());
                    if (detections.length === 0) {
                      faceDetected = false;
                      errorMessage = "Rejected: No face detected. A clear human face must be visible in the 2x2 photo.";
                    } else if (detections.length > 1) {
                      multipleFaces = true;
                      faceDetected = false;
                      errorMessage = "Rejected: Multiple faces detected. The photo must be a solo portrait.";
                    }
                  } catch (e) {
                    console.error("Face detection failed", e);
                  }
                }
                
                if (faceDetected && !whiteBackground) {
                  errorMessage = 'Rejected: The 2x2 photo does not appear to have a white background. A white background is required.';
                }
              }
            }

            // DETERMINE REVIEW STATUS
            let finalStatus = "PASS";
            
            // Format gates (hard fails)
            if (isWrongSlot || !dimensionsMatch || (field === 'picture_2x2_file' && (!whiteBackground || !faceDetected || multipleFaces))) {
               finalStatus = "FAIL";
            }
            // Mismatches or unreadable text -> review
            else if (field === 'psa_cert_file' && (!nameMatch || !dobMatch || !sexMatch)) {
               finalStatus = "NEEDS_REVIEW";
               // Don't override extractedName to "UNKNOWN" if we couldn't parse it well
               errorMessage = "Notice: Could not fully match identity in document. Will be flagged for manual review.";
            } else if (field === 'primary_id_file' && (!nameMatch || !dobMatch || !yearMatch || !serialMatch)) {
               finalStatus = "NEEDS_REVIEW";
               errorMessage = "Notice: Could not fully match OSCA details. Will be flagged for manual review.";
            }

            // Save results to state for submission
            setAutoCheckResults((prev: any) => ({
              ...prev,
              [field]: {
                status: finalStatus,
                format_ok: !isWrongSlot,
                text_extracted: isPdf && pdfText.length > 50,
                name_match: nameMatch,
                dob_match: dobMatch,
                sex_match: sexMatch,
                year_match: yearMatch,
                serial_match: serialMatch,
                white_bg: whiteBackground,
                aspect_ok: dimensionsMatch,
                face_detected: typeof faceDetected !== 'undefined' ? faceDetected : true
              }
            }));

            // Make the score reflect the status
            const score = finalStatus === 'PASS' ? 95 : (finalStatus === 'NEEDS_REVIEW' ? 50 : 10);

            setVerificationState({
              isOpen: true,
              fieldName: field,
              file: file,
              stage: 'results',
              score: score,
              nameMatch: nameMatch,
              dobMatch: dobMatch,
              sexMatch: sexMatch,
              yearMatch: yearMatch,
              serialMatch: serialMatch,
              dimensionsMatch: dimensionsMatch,
              sealMatch: sealMatch,
              whiteBackground: whiteBackground,
              documentType: detectedType,
              errorMessage: finalStatus === 'PASS' ? undefined : errorMessage,
              extractedName: extractedName || undefined,
              extractedDOB: extractedDOB || undefined,
              extractedSex: extractedSex || undefined,
              extractedSerial: extractedSerial || undefined,
              extractedYear: extractedYear || undefined,
              extractedAddress: extractedAddress || undefined,
            });
`;

// Replace from 'if (!whiteBackground) {' to the end of runValidation
const targetStart = "if (!whiteBackground) {\n                  errorMessage = 'Rejected: The 2x2 photo does not appear to have a white background. A white background is required.';\n                }\n              }\n            }";
const targetStartIdx = content.indexOf(targetStart);
if (targetStartIdx !== -1) {
    content = content.substring(0, targetStartIdx) + newValidationEnding + content.substring(setVerificationStateEnd);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Updated page.tsx with face-api and auto checks!");
} else {
    console.error("Could not find replacement target!");
}
