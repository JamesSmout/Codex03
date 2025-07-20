/* Project data structure */
const projectData = {
    key: 'C major',
    segments: []
};

const STRINGS = [40, 45, 50, 55, 59, 64]; // MIDI for E2 A2 D3 G3 B3 E4
const NUM_STRINGS = 6;
const NUM_FRETS = 22;

let activeSegment = 0;

function init() {
    createInitialSegments();
    buildFretboard();
    populateKeySelector();
    bindControls();
    render();
}

function createInitialSegments() {
    for (let i = 0; i < 4; i++) {
        projectData.segments.push({
            index: i,
            frets: [],
            notes: [],
            chordDetected: [],
            selectedChord: ''
        });
    }
}

function buildFretboard() {
    const fb = document.getElementById('fretboard');
    fb.innerHTML = '';
    for (let s = NUM_STRINGS; s >= 1; s--) {
        for (let f = 0; f < NUM_FRETS; f++) {
            const div = document.createElement('div');
            div.classList.add('fret');
            div.dataset.string = s;
            div.dataset.fret = f;
            div.addEventListener('click', () => toggleFret(s, f));
            fb.appendChild(div);
        }
    }
}

function populateKeySelector() {
    const selector = document.getElementById('key-selector');
    const notes = Tonal.Note.names();
    const majors = notes.map(n => `${n} major`);
    const minors = notes.map(n => `${n} minor`);
    [...majors, ...minors].forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        selector.appendChild(opt);
    });
    selector.value = projectData.key;
    selector.addEventListener('change', () => {
        projectData.key = selector.value;
        updateAllChordNames();
    });
}

function bindControls() {
    document.getElementById('prev-segment').addEventListener('click', () => moveSegment(-1));
    document.getElementById('next-segment').addEventListener('click', () => moveSegment(1));
    document.getElementById('segment-slider').addEventListener('input', e => {
        selectSegment(Number(e.target.value));
    });
}

function moveSegment(dir) {
    const newIndex = Math.min(Math.max(activeSegment + dir, 0), projectData.segments.length - 1);
    selectSegment(newIndex);
}

function render() {
    renderTimeline();
    selectSegment(activeSegment);
    suggestChords();
}

function renderTimeline() {
    const container = document.getElementById('timeline');
    container.innerHTML = '';
    projectData.segments.forEach((seg, idx) => {
        const div = document.createElement('div');
        div.classList.add('timeline-segment');
        if (idx === activeSegment) div.classList.add('active');
        div.textContent = seg.selectedChord || '---';
        div.addEventListener('click', () => selectSegment(idx));
        container.appendChild(div);
    });
    const slider = document.getElementById('segment-slider');
    slider.max = projectData.segments.length - 1;
    slider.value = activeSegment;
}

function selectSegment(index) {
    activeSegment = index;
    renderTimeline();
    updateFretboardView();
    updateChordInfo();
}

function toggleFret(string, fret) {
    const seg = projectData.segments[activeSegment];
    const existing = seg.frets.find(n => n.string === string);
    if (existing && existing.fret === fret) {
        seg.frets = seg.frets.filter(n => n.string !== string);
    } else {
        seg.frets = seg.frets.filter(n => n.string !== string);
        seg.frets.push({ string, fret });
    }
    updateNotes(seg);
    updateFretboardView();
    updateChordInfo();
    renderTimeline();
}

function updateFretboardView() {
    const seg = projectData.segments[activeSegment];
    const fb = document.getElementById('fretboard');
    fb.querySelectorAll('.fret').forEach(div => {
        const s = Number(div.dataset.string);
        const f = Number(div.dataset.fret);
        const sel = seg.frets.some(n => n.string === s && n.fret === f);
        div.classList.toggle('selected', sel);
    });
}

function updateNotes(seg) {
    seg.notes = seg.frets.map(n => {
        const midi = STRINGS[NUM_STRINGS - n.string] + n.fret;
        return Tonal.Note.fromMidi(midi);
    });
    detectChord(seg);
}

function detectChord(seg) {
    seg.chordDetected = Tonal.Chord.detect(seg.notes);
    if (!seg.selectedChord && seg.chordDetected.length) {
        seg.selectedChord = seg.chordDetected[0];
    }
}

function updateChordInfo() {
    const seg = projectData.segments[activeSegment];
    document.getElementById('selected-notes').textContent = 'Notes: ' + seg.notes.join(', ');
    const container = document.getElementById('chord-names');
    container.innerHTML = '';
    if (!seg.chordDetected.length) return;

    const mostLikely = pickMostLikelyChord(seg.chordDetected);
    const names = [mostLikely, ...seg.chordDetected.filter(n => n !== mostLikely)];
    names.forEach((name, idx) => {
        const div = document.createElement('div');
        div.classList.add('chord-option');
        if (name === seg.selectedChord) div.classList.add('selected');
        div.textContent = name;
        div.addEventListener('click', () => {
            seg.selectedChord = name;
            renderTimeline();
            updateChordInfo();
            suggestChords();
        });
        container.appendChild(div);
    });
}

function pickMostLikelyChord(names) {
    if (!names.length) return '';
    const keyRoot = projectData.key.split(' ')[0];
    return names.sort((a, b) => {
        const aScore = a.includes(keyRoot) ? 0 : 1;
        const bScore = b.includes(keyRoot) ? 0 : 1;
        return aScore - bScore || a.length - b.length;
    })[0];
}

function updateAllChordNames() {
    projectData.segments.forEach(seg => detectChord(seg));
    renderTimeline();
    updateChordInfo();
    suggestChords();
}

function suggestChords() {
    const container = document.getElementById('suggestions');
    container.innerHTML = '';
    const suggestions = getChordSuggestions();
    suggestions.forEach(sug => {
        const div = document.createElement('div');
        div.classList.add('suggestion');
        div.textContent = `${sug.name} (${sug.func})`;
        const details = document.createElement('div');
        details.classList.add('suggestion-details');
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Add';
        addBtn.addEventListener('click', () => addSuggestedChord(sug.name));
        const backBtn = document.createElement('button');
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => div.classList.remove('active'));
        details.appendChild(addBtn);
        details.appendChild(backBtn);
        div.appendChild(details);
        div.addEventListener('click', () => div.classList.toggle('active'));
        container.appendChild(div);
    });
}

function getChordSuggestions() {
    const key = projectData.key;
    const root = key.split(' ')[0];
    const isMinor = key.includes('minor');
    const scale = isMinor ? Tonal.Scale.get(`${root} natural minor`).notes : Tonal.Scale.get(`${root} major`).notes;
    const diatonic = scale.map((n, i) => {
        const quality = isMinor ? ['min','dim','maj','min','min','maj','maj'] : ['maj','min','min','maj','maj','min','dim'];
        return {
            name: `${n}${quality[i] === 'maj' ? '' : quality[i] === 'min' ? 'm' : 'dim'}`,
            func: ['I','ii','iii','IV','V','vi','vii°'][i]
        };
    });
    const lastChord = projectData.segments[activeSegment].selectedChord || '';
    let nextIdx = 4; // default V
    diatonic.forEach((c, idx) => {
        if (c.name.startsWith(lastChord[0])) {
            nextIdx = (idx + 1) % diatonic.length;
        }
    });
    return [diatonic[nextIdx], diatonic[(nextIdx+3)%7], diatonic[(nextIdx+4)%7]].slice(0,5);
}

function addSuggestedChord(name) {
    const idx = projectData.segments.length;
    projectData.segments.push({
        index: idx,
        frets: [],
        notes: [],
        chordDetected: [name],
        selectedChord: name
    });
    renderTimeline();
    suggestChords();
}

document.addEventListener('DOMContentLoaded', init);
