// Interface strings. Control names stay in the usual synth English; hints and help are translated.
const STR = {
  es: {
    play: 'Play', stop: 'Stop', playTip: 'Arranca o para el secuenciador (Espacio)',
    preset: 'Preset', save: 'Guardar', del: 'Borrar', export: 'Exportar', import: 'Importar',
    saveAs: 'Nombre del preset:', delAsk: '¿Borrar el preset «{0}»?', factory: 'De fábrica', user: 'Míos',
    load: 'Cargar…', loadTip: 'Carga un audio de tu equipo (también puedes soltarlo sobre la onda)',
    gateTip: 'Duración de la nota en pasos. Por encima de 100% la nota se liga con la siguiente: no se redispara y el tono se desliza (GLIDE).',
    trig: 'Probar', trigTip: 'Dispara el canal (teclas Q…P)',
    assign: 'Asignar', assignTip: 'Pulsa y mueve los controles que quieras: la posición de partida será el mínimo de la macro y donde los dejes, el máximo. Con Alt se asigna el mismo control en los 10 canales. Pulsa otra vez para terminar.',
    learning: 'Asignando a «{0}»: mueve controles… (Alt = los 10 canales)',
    removeFrom: 'Quitar de «{0}»', reset: 'Valor inicial', clearMacro: 'Vaciar macro', rename: 'Renombrar', newName: 'Nuevo nombre:',
    targets: '{0} controles',
    mTrig: 'Pasos: clic pone o quita, arrastra para pintar, Mayús+clic acento',
    mVel: 'Intensidad de cada paso: arrastra arriba/abajo', mProb: 'Probabilidad de que suene cada paso',
    mNote: 'Nota (semitonos) de cada paso', mRoll: 'Redoble: repeticiones dentro del paso',
    rndAll: 'Todo al azar', rndTip: 'Nuevo patrón al azar para esta pista', clear: 'Vaciar',
    evolve: 'Evolución', evolveTip: 'El patrón cambia poco a poco: cada pista según su control EVO', every: 'cada', bars: 'compases',
    revert: 'Volver', revertTip: 'Vuelve al patrón tal como lo dejaste', keep: 'Fijar', keepTip: 'Se queda con el patrón evolucionado como nuevo punto de partida',
    len: 'Pasos de la pista', prob: 'Probabilidad de la pista', evo: 'Cuánto evoluciona esta pista',
    mute: 'Silenciar', solo: 'Solo', help: 'Ayuda', loading: 'Cargando samples…',
    noStore: 'El sample se ha cargado, pero no se pudo guardar en el navegador: habrá que cargarlo otra vez al volver.',
    badFile: 'No se pudo leer el archivo: ', badPreset: 'El archivo no es un preset de TextureDrums.',
    helpText: `<h2>TextureDrums</h2>
<p>Diez canales iguales. Cada uno funciona en uno de tres modos: <b>DRUM</b> (un circuito analógico modelado más un sample), <b>GRAIN</b> (sampler granular) o <b>SYNTH</b> (sintetizador para bajos y leads: dos osciladores, sub, filtro de 4 polos y envolventes; la nota de cada paso da la melodía y con GATE por encima de 100% las notas se ligan y deslizan). En DRUM y SYNTH, <b>GRAIN MOD</b> hace que los granos (sin oírse) modulen la voz: RING (la multiplican), FM (le doblan el tono) o FILTER (mueven el filtro).</p>
<p><b>Sampler granular</b>: elige o carga un sample. El bucle va de START a END, hacia delante, atrás o ping-pong, y cada punto tiene su LFO. Arrastra los marcadores sobre la onda. De ahí salen hasta 4 notas a la vez, cada una desde su OFFSET y con su PITCH. Con ENV en DRONE la textura suena mientras el secuenciador corre.</p>
<p><b>Efectos</b>: delay, reverb y crusher tienen cada uno su pestaña (FX), con sus controles y el envío de los 10 canales. Cada canal tiene además sus tres envíos (0–100%) en SENDS.</p>
<p><b>Secuenciador</b>: 10 pistas de hasta 16 pasos. Los botones TRIG, VEL, PROB, NOTE y ROLL eligen qué se edita. Cada pista tiene su longitud (LEN), probabilidad (PROB) y evolución (EVO). El dado crea un patrón al azar. Con <b>Evolución</b> activa el patrón va cambiando alrededor del que escribiste: «Volver» lo recupera y «Fijar» se queda con el actual.</p>
<p><b>Macros</b>: pulsa «Asignar» en una macro y mueve controles. Clic derecho en un control para quitarlo.</p>
<p><b>Controles</b>: arrastra arriba/abajo o usa la rueda; Mayús = fino; doble clic = valor inicial. Teclas: Espacio = play, 1…0 = canal, Q…P = disparar canal. MIDI: notas 36–45 disparan los canales, CC 70–77 mueven las macros.</p>
<p>Los samples de cajas de ritmos (CR-78, LinnDrum, Rhythm King, TR-505) son de dominio público; ver <code>samples/README.md</code>.</p>`,
  },
  en: {
    play: 'Play', stop: 'Stop', playTip: 'Start or stop the sequencer (Space)',
    preset: 'Preset', save: 'Save', del: 'Delete', export: 'Export', import: 'Import',
    saveAs: 'Preset name:', delAsk: 'Delete the preset "{0}"?', factory: 'Factory', user: 'Mine',
    load: 'Load…', loadTip: 'Load an audio file from your computer (or drop it on the waveform)',
    gateTip: 'Note length in steps. Over 100% the note ties into the next one: no retrigger, and the pitch slides (GLIDE).',
    trig: 'Audition', trigTip: 'Trigger the channel (keys Q…P)',
    assign: 'Assign', assignTip: 'Press, then move the controls you want: where each starts is the macro minimum and where you leave it is the maximum. Hold Alt to assign the same control on all 10 channels. Press again to finish.',
    learning: 'Assigning to "{0}": move controls… (Alt = all 10 channels)',
    removeFrom: 'Remove from "{0}"', reset: 'Default value', clearMacro: 'Clear macro', rename: 'Rename', newName: 'New name:',
    targets: '{0} controls',
    mTrig: 'Steps: click toggles, drag paints, Shift+click accents',
    mVel: 'Velocity of each step: drag up/down', mProb: 'Chance that each step plays',
    mNote: 'Note (semitones) of each step', mRoll: 'Roll: repeats inside the step',
    rndAll: 'Randomise all', rndTip: 'New random pattern for this track', clear: 'Clear',
    evolve: 'Evolve', evolveTip: 'The pattern changes little by little: each track by its EVO control', every: 'every', bars: 'bars',
    revert: 'Revert', revertTip: 'Back to the pattern as you left it', keep: 'Keep', keepTip: 'Keep the evolved pattern as the new starting point',
    len: 'Track length in steps', prob: 'Track probability', evo: 'How much this track evolves',
    mute: 'Mute', solo: 'Solo', help: 'Help', loading: 'Loading samples…',
    noStore: 'The sample is loaded but could not be stored in the browser: it will need loading again next time.',
    badFile: 'Could not read the file: ', badPreset: 'The file is not a TextureDrums preset.',
    helpText: `<h2>TextureDrums</h2>
<p>Ten identical channels. Each works in one of three modes: <b>DRUM</b> (a modelled analog circuit plus a sample), <b>GRAIN</b> (granular sampler) or <b>SYNTH</b> (a synth for basses and leads: two oscillators, sub, 4-pole filter and envelopes; each step's note gives the melody, and with GATE over 100% notes tie and slide). In DRUM and SYNTH, <b>GRAIN MOD</b> lets the grains (unheard) modulate the voice: RING (multiply it), FM (bend its pitch) or FILTER (move the filter).</p>
<p><b>Granular sampler</b>: pick or load a sample. The loop runs from START to END, forward, reverse or ping-pong, and each point has its own LFO. Drag the markers on the waveform. Up to 4 notes come out of it at once, each from its own OFFSET and at its own PITCH. With ENV on DRONE the texture sounds while the sequencer runs.</p>
<p><b>Effects</b>: delay, reverb and crusher each have their own tab (FX), with their controls and the sends of all 10 channels. Each channel also has its three sends (0–100%) under SENDS.</p>
<p><b>Sequencer</b>: 10 tracks of up to 16 steps. TRIG, VEL, PROB, NOTE and ROLL choose what you edit. Each track has its own length (LEN), probability (PROB) and evolution (EVO). The dice makes a random pattern. With <b>Evolve</b> on, the pattern keeps changing around the one you wrote: "Revert" brings it back and "Keep" adopts the current one.</p>
<p><b>Macros</b>: press "Assign" on a macro and move controls. Right-click a control to remove it.</p>
<p><b>Controls</b>: drag up/down or use the wheel; Shift = fine; double-click = default. Keys: Space = play, 1…0 = channel, Q…P = trigger channel. MIDI: notes 36–45 trigger the channels, CC 70–77 move the macros.</p>
<p>The drum machine samples (CR-78, LinnDrum, Rhythm King, TR-505) are public domain; see <code>samples/README.md</code>.</p>`,
  },
};
let lang = 'es';
try { lang = localStorage.getItem('texturedrums.lang') || (navigator.language || 'es').slice(0, 2); } catch (e) { /* private mode */ }
if (!STR[lang]) lang = 'en';
export const getLang = () => lang;
export function setLang(l) { lang = STR[l] ? l : 'en'; try { localStorage.setItem('texturedrums.lang', lang); } catch (e) { /* ignore */ } }
export const t = (k, ...a) => (STR[lang][k] ?? STR.en[k] ?? k).replace(/\{(\d)\}/g, (_, i) => a[i]);
