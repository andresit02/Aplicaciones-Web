const loader = {
    resources: {},
    loadedCount: 0,
    totalCount: 0,
    onload: null, 
    audioContext: null,
    
    // ⭐️ NUEVO: Control de Mute
    isMuted: false, 
    masterGainNode: null, 

    init() {
        this.loadedCount = 0;
        this.totalCount = 0;
        this.resources = {};
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // ⭐️ Inicializar el GainNode Maestro
        if (!this.masterGainNode) {
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            // El volumen inicial es 1.0 (no silenciado)
            this.masterGainNode.gain.value = 1.0; 
        }
    },

    /**
     * Carga una imagen.
     * @param {string} url - Ruta del archivo de imagen.
     * @returns {Image} El objeto Image.
     */
    loadImage(url) {
        this.totalCount++; 
        let image = new Image();
        image.src = url;

        image.onload = () => {
            this.loadedCount++; 
            if (this.loadedCount === this.totalCount && this.onload) {
                this.onload(); 
            }
        };

        image.onerror = () => {
            console.error(`Error loading image: ${url}`);
            this.loadedCount++; 
            if (this.loadedCount === this.totalCount && this.onload) {
                this.onload();
            }
        };
        
        return image;
    },

    /**
     * Carga un archivo de audio como un ArrayBuffer y lo decodifica.
     * @param {string} url - Ruta del archivo de audio.
     * @returns {Promise<AudioBuffer>} El buffer de audio decodificado.
     */
    loadAudio(url) {
        this.totalCount++;
        
        return fetch(url)
            .then(response => response.arrayBuffer())
            .then(buffer => this.audioContext.decodeAudioData(buffer))
            .then(audioBuffer => {
                this.loadedCount++;
                if (this.loadedCount === this.totalCount && this.onload) {
                    this.onload();
                }
                return audioBuffer;
            })
            .catch(error => {
                console.error(`Error loading or decoding audio: ${url}`, error);
                this.loadedCount++;
                if (this.loadedCount === this.totalCount && this.onload) {
                    this.onload();
                }
                return null;
            });
    }
};

/**
 * Función global para reproducir un AudioBuffer.
 * Crea un nuevo source node por cada reproducción.
 * @param {AudioBuffer} buffer - El buffer de audio decodificado.
 * @param {boolean} [loop=false] - Si el sonido debe reproducirse en bucle.
 * @param {number} [volume=1.0] - Volumen (0.0 a 1.0).
 * @returns {AudioBufferSourceNode} El nodo de fuente de audio, útil para detener música en bucle.
 */
function playSound(buffer, loop = false, volume = 1.0) {
    // CRÍTICO: Si no hay buffer o el contexto de audio no está corriendo, salir.
    if (!loader.audioContext || !buffer || loader.audioContext.state !== 'running') return;

    const source = loader.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    
    // Configuración de volumen (GainNode local)
    const gainNode = loader.audioContext.createGain();
    gainNode.gain.value = volume; 

    // ⭐️ Conexión: Source -> Gain Local -> Gain Maestro
    source.connect(gainNode);
    gainNode.connect(loader.masterGainNode);

    source.start(0); 
    return source;
}