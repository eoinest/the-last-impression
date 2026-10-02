const root = document.documentElement;
const body = document.body;
history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const state = {
  opened: false,
  focus: 0,
  focusing: false,
  calibrationMoves: 0,
  calibrationProgress: { contrast: 0, depth: 0, proximity: 0 },
  calibrationLast: { contrast: 17, depth: 31, proximity: 8 },
  destructionStep: 0,
  audioSequenceStarted: false,
  readyToClose: false,
  closeAttempts: 0,
  audio: false,
  audioContext: null,
  audioNodes: [],
  audioMaster: null,
  focusFrame: 0,
  lastFocusTime: 0,
};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const openButton = $("#open-evidence");
const holdButton = $("#hold-focus");
const focusVoid = $("#focus-void");
const focusStatus = $("#focus-status");
const focusPercent = $("#focus-percent");
const subjectStatus = $("#subject-status");
const viewerCount = $("#viewer-count");
const soundToggle = $("#sound-toggle");
const roomToneButton = $("#room-tone-button");
const scanImage = $("#scan-image");
const mainExperience = $("main");
const archiveHeader = $(".archive-header");

mainExperience.inert = true;
mainExperience.setAttribute("aria-hidden", "true");
archiveHeader.inert = true;
archiveHeader.setAttribute("aria-hidden", "true");

function revealSection(id) {
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  $(`#${id}`).scrollIntoView({ behavior, block: "start" });
}

const gatedSections = ["transcript", "calibration", "room-tone", "destruction", "closure"];
gatedSections.forEach((id) => {
  const section = $(`#${id}`);
  section.inert = true;
  section.setAttribute("aria-hidden", "true");
});

function unlockSection(id) {
  const section = $(`#${id}`);
  if (!section || !section.classList.contains("is-locked")) return;
  section.classList.remove("is-locked");
  section.inert = false;
  section.removeAttribute("aria-hidden");
}

function setPointer(event) {
  const x = `${event.clientX}px`;
  const y = `${event.clientY}px`;
  root.style.setProperty("--mx", x);
  root.style.setProperty("--my", y);

  if (!scanImage) return;
  const rect = scanImage.getBoundingClientRect();
  const localX = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  const localY = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
  scanImage.style.setProperty("--mx", `${localX}%`);
  scanImage.style.setProperty("--my", `${localY}%`);
}

window.addEventListener("pointermove", setPointer, { passive: true });

function openEvidence() {
  if (state.opened) return;
  state.opened = true;
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  body.classList.remove("sealed");
  body.classList.add("is-open");
  mainExperience.inert = false;
  mainExperience.removeAttribute("aria-hidden");
  archiveHeader.inert = false;
  archiveHeader.removeAttribute("aria-hidden");
  if ($("#sound-on-entry").checked) startAudio();
  setTimeout(() => holdButton.focus({ preventScroll: true }), 950);
}

openButton.addEventListener("click", openEvidence);
window.addEventListener("keydown", (event) => {
  if (!state.opened && event.key === "Enter") openEvidence();
});

function focusMessage(progress) {
  if (progress < 14) return "surface layer removed";
  if (progress < 38) return "foreground absent";
  if (progress < 65) return "distance recalculated";
  if (progress < 92) return "observer acquired";
  return "your outline has been accepted";
}

function drawFocus(now) {
  if (!state.focusing) return;
  if (!state.lastFocusTime) state.lastFocusTime = now;
  const delta = Math.min(80, now - state.lastFocusTime);
  state.lastFocusTime = now;
  state.focus = Math.min(100, state.focus + delta / 70);
  root.style.setProperty("--focus-progress", `${state.focus}%`);
  root.style.setProperty("--focus-decimal", (state.focus / 100).toFixed(3));
  root.style.setProperty("--image-scale", (1 + state.focus / 2500).toFixed(3));
  focusPercent.textContent = `${String(Math.floor(state.focus)).padStart(2, "0")}%`;
  focusStatus.textContent = focusMessage(state.focus);
  if (state.focus >= 100) {
    completeFocus();
    return;
  }
  state.focusFrame = requestAnimationFrame(drawFocus);
}

function beginFocus(event) {
  if (!state.opened || body.classList.contains("focus-complete")) return;
  event.preventDefault();
  state.focusing = true;
  state.lastFocusTime = 0;
  if (event.pointerId !== undefined) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  $(".hold-button__label").textContent = "Release";
  state.focusFrame = requestAnimationFrame(drawFocus);
}

function stopFocus() {
  if (!state.focusing) return;
  state.focusing = false;
  state.lastFocusTime = 0;
  cancelAnimationFrame(state.focusFrame);
  if (state.focus < 100) {
    $(".hold-button__label").textContent = "Do not focus";
    focusStatus.textContent = state.focus > 7 ? "focus retained without request" : "stabilizing residual image…";
  }
}

function completeFocus() {
  stopFocus();
  state.focus = 100;
  body.classList.add("focus-complete");
  $(".hold-button__label").textContent = "Observer acquired";
  holdButton.disabled = true;
  focusStatus.textContent = "you held it open longer than the technician did";
  subjectStatus.textContent = "partial";
  $("#integrity").textContent = "compromised";
  unlockSection("transcript");
  setTimeout(() => revealSection("transcript"), 1300);
}

[holdButton, focusVoid].forEach((element) => {
  element.addEventListener("pointerdown", beginFocus);
  element.addEventListener("pointerup", stopFocus);
  element.addEventListener("pointercancel", stopFocus);
  element.addEventListener("pointerleave", (event) => {
    if (event.buttons) stopFocus();
  });
});

holdButton.addEventListener("keydown", (event) => {
  if ((event.key === " " || event.key === "Enter") && !event.repeat) beginFocus(event);
});
holdButton.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") stopFocus();
});

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting || entry.target.classList.contains("is-locked")) return;
    entry.target.classList.add("in-view");
    if (entry.target.id === "transcript") {
      setTimeout(() => { subjectStatus.textContent = "partial"; }, 2800);
      if (body.classList.contains("focus-complete")) {
        setTimeout(() => unlockSection("calibration"), 3200);
      }
    }
    if (entry.target.id === "closure") {
      subjectStatus.textContent = "nearly resolved";
    }
  });
}, { threshold: 0.28 });

$$('.section').forEach((section) => sectionObserver.observe(section));

const calibrationMessages = [
  "contrast corrected",
  "near plane corrected",
  "your distance: decreasing",
  "input direction ignored",
  "thank you for holding still",
];

$$('.calibration-slider').forEach((slider) => {
  slider.addEventListener("input", () => {
    const name = slider.dataset.control;
    const value = Number(slider.value);
    const delta = Math.abs(value - state.calibrationLast[name]);
    state.calibrationLast[name] = value;
    state.calibrationProgress[name] = Math.min(36, state.calibrationProgress[name] + delta);
    $(`#${name}-output`).textContent = String(slider.value).padStart(2, "0");
    const progress = Object.values(state.calibrationProgress).reduce((sum, current) => sum + current, 0) / 108;
    const distance = Math.max(0.18, 4.72 - progress * 4.54);
    $("#distance-value").textContent = `${distance.toFixed(2)} m`;
    $("#control-message").textContent = calibrationMessages[Math.min(calibrationMessages.length - 1, Math.floor(progress * calibrationMessages.length))];
    root.style.setProperty("--image-contrast", (1.18 + progress * 1.1).toFixed(2));
    root.style.setProperty("--image-scale", (1.035 + progress * .01).toFixed(3));

    if (progress > .5 && viewerCount.textContent === "1") {
      viewerCount.textContent = "2";
      setTimeout(() => { viewerCount.textContent = "1"; }, 850);
    }

    const complete = Object.values(state.calibrationProgress).every((amount) => amount >= 36);
    if (complete && !body.classList.contains("calibration-complete")) {
      body.classList.add("calibration-complete");
      $$('.calibration-slider').forEach((control) => { control.disabled = true; });
      $("#control-message").textContent = "all controls locked · another position has opened";
      subjectStatus.textContent = "nearly resolved";
      unlockSection("room-tone");
      setTimeout(() => revealSection("room-tone"), 900);
      if (state.audio) startAudioSequence();
    }
  });
});

function startAudioSequence() {
  if (state.audioSequenceStarted) return;
  state.audioSequenceStarted = true;
  const lines = [
    "Opened the evidence.",
    "Held the center.",
    "Increased proximity.",
    "Returned when it moved.",
    "That is how it learned the shape of you.",
  ];
  lines.forEach((line, index) => {
    setTimeout(() => {
      $("#audio-transcript").textContent = line;
      if (index === lines.length - 1) {
        unlockSection("destruction");
      }
    }, 900 + index * 1500);
  });
}

function createNoise(context, destination) {
  const duration = 2;
  const buffer = context.createBuffer(1, context.sampleRate * duration, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * .16;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 640;
  const gain = context.createGain();
  gain.gain.value = .055;
  source.connect(filter).connect(gain).connect(destination);
  source.start();
  return [source, gain];
}

function startAudio() {
  if (state.audio) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  state.audioContext ||= new AudioContext();
  state.audioContext.resume();
  const compressor = state.audioContext.createDynamicsCompressor();
  compressor.threshold.value = -26;
  compressor.knee.value = 18;
  compressor.ratio.value = 8;
  const master = state.audioContext.createGain();
  master.gain.setValueAtTime(0, state.audioContext.currentTime);
  master.gain.linearRampToValueAtTime(.9, state.audioContext.currentTime + .6);
  master.connect(compressor).connect(state.audioContext.destination);
  const hum = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  hum.type = "sine";
  hum.frequency.value = 47;
  gain.gain.value = .035;
  hum.connect(gain).connect(master);
  hum.start();
  const noiseNodes = createNoise(state.audioContext, master);
  state.audioMaster = master;
  state.audioNodes = [hum, gain, ...noiseNodes, master, compressor];
  state.audio = true;
  soundToggle.textContent = "Sound: on";
  soundToggle.setAttribute("aria-pressed", "true");
  $("#room-tone").classList.add("playing");
  roomToneButton.textContent = "Pause";
  if (body.classList.contains("calibration-complete")) startAudioSequence();
}

function stopAudio() {
  if (!state.audio) return;
  const nodes = [...state.audioNodes];
  const context = state.audioContext;
  if (state.audioMaster && context) {
    state.audioMaster.gain.cancelScheduledValues(context.currentTime);
    state.audioMaster.gain.setValueAtTime(state.audioMaster.gain.value, context.currentTime);
    state.audioMaster.gain.linearRampToValueAtTime(0, context.currentTime + .28);
  }
  setTimeout(() => {
    nodes.forEach((node) => {
      try { node.stop?.(); } catch (_) { /* already stopped */ }
      try { node.disconnect?.(); } catch (_) { /* already disconnected */ }
    });
  }, 320);
  state.audioNodes = [];
  state.audioMaster = null;
  state.audio = false;
  soundToggle.textContent = "Sound: off";
  soundToggle.setAttribute("aria-pressed", "false");
  $("#room-tone").classList.remove("playing");
  roomToneButton.textContent = "It is still playing";
  setTimeout(() => {
    if (!state.audio) roomToneButton.textContent = "Play room tone";
  }, 3000);
}

function playFinalImpact() {
  if (!state.audio || !state.audioContext || !state.audioMaster) return;
  const now = state.audioContext.currentTime;
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(92, now);
  oscillator.frequency.exponentialRampToValueAtTime(41, now + .42);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(.12, now + .025);
  gain.gain.exponentialRampToValueAtTime(.0001, now + .48);
  oscillator.connect(gain).connect(state.audioMaster);
  oscillator.start(now);
  oscillator.stop(now + .5);
}

soundToggle.addEventListener("click", () => state.audio ? stopAudio() : startAudio());
roomToneButton.addEventListener("click", () => {
  if (state.audio) stopAudio(); else startAudio();
  startAudioSequence();
});
$("#continue-silent").addEventListener("click", () => {
  playFinalImpact();
  setTimeout(stopAudio, 520);
  startAudioSequence();
  $("#continue-silent").disabled = true;
  $("#continue-silent").textContent = "Transcript recovering…";
});

const damageStates = [
  { time: "03:21", copy: "file deleted", filter: "grayscale(1) contrast(1.3)" },
  { time: "03:21", copy: "file returned", filter: "grayscale(1) invert(1) contrast(1.8)" },
  { time: "03:24", copy: "drive destroyed", filter: "grayscale(1) contrast(4) brightness(.22)" },
  { time: "03:24", copy: "image printed inside locked archive", filter: "grayscale(1) contrast(.45) brightness(1.8)" },
  { time: "03:31", copy: "technician covered the lens", filter: "grayscale(1) brightness(.07) contrast(5)" },
  { time: "03:34", copy: "technician understood there was no lens", filter: "grayscale(1) contrast(2.4) sepia(.2)" },
];

$("#damage-timeline").addEventListener("input", (event) => {
  let index = Number(event.target.value);
  if (index > state.destructionStep + 1) index = state.destructionStep + 1;
  event.target.value = String(index);
  state.destructionStep = Math.max(state.destructionStep, index);
  const damage = damageStates[index];
  $("#damage-time").textContent = damage.time;
  $("#damage-copy").textContent = damage.copy;
  $("#damage-image").style.filter = damage.filter;
  $("#timeline-count").textContent = `${String(index + 1).padStart(2, "0")} / 06`;
  $$('.log-list li').forEach((line, lineIndex) => line.classList.toggle("is-active", lineIndex <= index));
  if (index === 4) {
    $("#damage-image").style.opacity = "0";
    setTimeout(() => { $("#damage-image").style.opacity = "1"; }, 700);
  }
  if (index === 5) {
    unlockSection("closure");
    setTimeout(() => revealSection("closure"), 850);
  }
});

const closeButton = $("#close-evidence");
const attemptCount = $("#attempt-count");

function evadeClose() {
  if (state.closeAttempts >= 3) return;
  state.closeAttempts += 1;
  if (matchMedia("(pointer: fine)").matches) {
    const x = (Math.random() * 2 - 1) * 240;
    const y = (Math.random() * 2 - 1) * 70;
    closeButton.style.transform = `translate(${x}px, ${y}px)`;
  }
  attemptCount.textContent = `attempts remaining: ${3 - state.closeAttempts}`;
  if (state.closeAttempts === 3) {
    setTimeout(() => {
      closeButton.style.transform = "none";
      closeButton.textContent = "Turn it around";
      attemptCount.textContent = "the file has closed around you";
      state.readyToClose = true;
    }, 380);
  }
}

closeButton.addEventListener("pointerenter", evadeClose);
closeButton.addEventListener("click", () => {
  if (!state.readyToClose) {
    evadeClose();
    return;
  }
  stopAudio();
  const finale = $("#finale");
  finale.classList.add("is-active");
  finale.setAttribute("aria-hidden", "false");
  mainExperience.inert = true;
  mainExperience.setAttribute("aria-hidden", "true");
  archiveHeader.inert = true;
  archiveHeader.setAttribute("aria-hidden", "true");
  body.classList.add("sealed");
  const subjectDelay = matchMedia("(prefers-reduced-motion: reduce)").matches ? 850 : 8500;
  setTimeout(() => { $("#final-subject").textContent = "The previous viewer"; }, subjectDelay);
  setTimeout(() => $("#finale-title").focus({ preventScroll: true }), 100);
});

$("#restart").addEventListener("click", () => window.location.reload());

let frame = 0;
setInterval(() => {
  if (!state.opened || document.hidden) return;
  frame += 1;
  $("#scan-time").textContent = `03:17:06:${String(frame % 30).padStart(2, "0")}`;
}, 130);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    state.audioContext?.suspend();
    return;
  }
  if (state.audio) state.audioContext?.resume();
  if (!state.opened || body.classList.contains("focus-complete")) return;
  focusStatus.textContent = "movement detected outside frame";
  setTimeout(() => { focusStatus.textContent = "please remain where it can see you"; }, 900);
});
