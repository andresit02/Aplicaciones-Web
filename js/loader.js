const loader = {
    resources: {},
    loadedCount: 0,
    totalCount: 0,
    onload: null, 
    audioContext: null, // NUEVO: Contexto de audio

    init() {
        this.loadedCount = 0;
        this.totalCount = 0;
        this.resources = {};
        // NUEVO: Inicializar AudioContext si no existe
        if (!this.audioContext) {
            // Se usa window.AudioContext o window.webkitAudioContext (para compatibilidad)
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
     * NUEVO: Carga un archivo de audio como un ArrayBuffer y lo decodifica.
     * @param {string} url - Ruta del archivo de audio.
     * @returns {Promise<AudioBuffer>} El buffer de audio decodificado.
     */
    loadAudio(url) {
        this.totalCount++;
        
        // Se usa fetch para obtener el archivo de audio como un ArrayBuffer
        return fetch(url)
            .then(response => response.arrayBuffer())
            // Se decodifica el ArrayBuffer a un AudioBuffer
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
                // Retorna null o un buffer vacío para no detener la carga del juego
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
    if (!loader.audioContext || !buffer) return;

    // Crea un nuevo nodo de fuente (AudioBufferSourceNode)
    const source = loader.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    
    // Configuración de volumen (GainNode)
    const gainNode = loader.audioContext.createGain();
    gainNode.gain.value = volume;

    // Conecta los nodos: Source -> Gain -> Destination (altavoces)
    source.connect(gainNode);
    gainNode.connect(loader.audioContext.destination);

    source.start(0); // Comienza la reproducción inmediatamente
    return source; // Retorna el source para permitir control externo (detener música)
}