/**
 * Módulo para la carga de recursos (imágenes y audio).
 * Gestiona el conteo de carga y el estado global de mute de audio.
 */
const loader = {
    resources: {},
    loadedCount: 0,
    totalCount: 0,
    onload: null, // Callback a ejecutar cuando todos los recursos estén cargados
    audioContext: null,
    
    // Control de Mute
    isMuted: false, 
    masterGainNode: null, // Nodo de ganancia maestro para control global de volumen/mute

    /**
     * Inicializa el estado del cargador y el AudioContext.
     */
    init() {
        this.loadedCount = 0;
        this.totalCount = 0;
        this.resources = {};
        if (!this.audioContext) {
            // Inicializa el AudioContext (puede estar en estado 'suspended' inicialmente)
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Inicializar el GainNode Maestro
        if (!this.masterGainNode) {
            this.masterGainNode = this.audioContext.createGain();
            // Conecta el nodo de ganancia maestro a la salida de audio del sistema
            this.masterGainNode.connect(this.audioContext.destination);
            // El volumen inicial es 1.0 (no silenciado)
            this.masterGainNode.gain.value = 1.0; 
        }
    },

    /**
     * Carga una imagen y gestiona el conteo de recursos cargados.
     * @param {string} url - Ruta del archivo de imagen.
     * @returns {Image} El objeto Image.
     */
    loadImage(url) {
        this.totalCount++; 
        let image = new Image();
        image.src = url;

        // Callback de éxito
        image.onload = () => {
            this.loadedCount++; 
            this.checkLoadCompletion();
        };

        // Callback de error
        image.onerror = () => {
            console.error(`Error loading image: ${url}`);
            this.loadedCount++; 
            this.checkLoadCompletion();
        };
        
        return image;
    },

    /**
     * Carga un archivo de audio como un ArrayBuffer y lo decodifica en un AudioBuffer.
     * @param {string} url - Ruta del archivo de audio.
     * @returns {Promise<AudioBuffer>} El buffer de audio decodificado.
     */
    loadAudio(url) {
        this.totalCount++;
        
        return fetch(url)
            .then(response => response.arrayBuffer()) // Obtiene los datos brutos del archivo
            .then(buffer => this.audioContext.decodeAudioData(buffer)) // Decodifica los datos de audio
            .then(audioBuffer => {
                this.loadedCount++;
                this.checkLoadCompletion();
                return audioBuffer;
            })
            .catch(error => {
                console.error(`Error loading or decoding audio: ${url}`, error);
                this.loadedCount++;
                this.checkLoadCompletion();
                return null;
            });
    },

    /**
     * Verifica si todos los recursos se han cargado y ejecuta el callback `onload`.
     */
    checkLoadCompletion() {
        if (this.loadedCount === this.totalCount && this.onload) {
            this.onload(); 
        }
    }
};

/**
 * Función global para reproducir un AudioBuffer.
 * Crea un nuevo source node por cada reproducción para permitir la superposición de sonidos.
 * @param {AudioBuffer} buffer - El buffer de audio decodificado.
 * @param {boolean} [loop=false] - Si el sonido debe reproducirse en bucle.
 * @param {number} [volume=1.0] - Volumen (0.0 a 1.0) para este sonido específico.
 * @returns {AudioBufferSourceNode} El nodo de fuente de audio, útil para detener música en bucle.
 */
function playSound(buffer, loop = false, volume = 1.0) {
    // CRÍTICO: Si no hay buffer o el contexto de audio no está corriendo, salir.
    if (!loader.audioContext || !buffer || loader.audioContext.state !== 'running') return;

    const source = loader.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    
    // Configuración de volumen local (GainNode) para este sonido
    const gainNode = loader.audioContext.createGain();
    gainNode.gain.value = volume; 

    // Conexión del flujo de audio: Source -> Gain Local -> Gain Maestro -> Destino
    source.connect(gainNode);
    gainNode.connect(loader.masterGainNode);

    source.start(0); // Inicia la reproducción inmediatamente (offset 0)
    return source;
}