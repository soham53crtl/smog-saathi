// Hard-coded emergency guidance that never depends on the model.

const EMERGENCY =
  /\b(breathless\w*|short(ness)? of breath|(can['’]?t|cannot|can not|unable to) breathe|(difficulty|trouble|struggling|problem) (in |with )?breathing|gasping|chest pain|chest (is |feels )?tight\w*|blue (lips|face)|faint(ed|ing)|unconscious|seizure|asthma attack)\b|saans|साँस|सांस|सास/iu;
/** Fixed emergency guidance, returned whenever a message describes a possible medical emergency. @returns {string|null} */
export function emergencyNotice(/** @type {unknown} */ text) {
  return EMERGENCY.test(String(text ?? ""))
    ? "This may be an emergency. Call 112 or go to the nearest hospital now; do not wait for the air to improve.\nयह आपातकाल हो सकता है। अभी 112 पर कॉल करें या नज़दीकी अस्पताल जाएँ।"
    : null;
}
