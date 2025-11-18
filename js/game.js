// game.js 

// **********************************************
// VARIABLES GLOBALES
// **********************************************

// Control de tiempo y entrada
let lastUpdateTime = Date.now();
// Variables para el cálculo de FPS
let fpsMeter = 0; // Valor actual de FPS
let frameCount = 0;
let lastFPSTime = Date.now();
// Variable para almacenar la puntuación más alta (persistencia con localStorage)
let highScore = parseInt(localStorage.getItem('spaceWarHighScore') || 0); 
let input = { left: false, right: false, fire: false }; // Control de entrada (teclado/ratón/táctil)
let assets = { // Contenedor de recursos cargados
    playerImage: null, 
    enemyImage: null,      // Tu enemigo rojo original
    enemyImage2: null,     // Nueva nave enemiga 1
    enemyImage3: null,     // Nueva nave enemiga 2
    bulletImage: null,
    backgroundImage: null,
    
    // Recursos de Audio
    menuMusic: null,
    shootSound: null,
    hitSound: null,
    gameOverSound: null,
}; 
// Mapa de entidades de juego: Box2D Body (key) -> UserData (value). Mantiene los cuerpos vivos.
let gameEntities = new Map(); 

// Variables para la lógica de oleadas/spawn (simplificadas)
let spawnTimer = 0;
const spawnInterval = 500; // Intervalo base: Un enemigo cada 500ms

/**
 * Módulo principal del juego (Game Object).
 */
const game = {  
    // Propiedades de la ventana y estado
    canvas: null,
    context: null,
    scale: 1, 
    state: 'menu',
    animationFrameId: null, // ID para requestAnimationFrame (Draw loop)
    
    // Referencia al nodo de la música del menú para poder detenerla al cambiar de estado
    currentMusicNode: null, 
    
    // PROPIEDADES PARA CONTROL DE DIFICULTAD PROGRESIVA
    timeElapsed: 0, // Tiempo total jugado en milisegundos
    difficultyFactor: 1.0, // Multiplicador de velocidad y frecuencia (1.0 = base)
    difficultyIncreaseRate: 0.15, // Aumentar velocidad/frecuencia 15% por ciclo
    difficultyIncreaseTime: 4000, // Cada 4 segundos
    lastDifficultyUpdate: 0, 

    // PROPIEDADES PARA EL PARPADEO VISUAL DEL FONDO (efecto de alerta/neón)
    backgroundFlashState: 0, // 0=Inactivo, 1=Aumentando opacidad, 2=Disminuyendo opacidad
    backgroundFlashOpacity: 0.3, // Opacidad actual
    backgroundFlashPatterns: [
        { threshold: 0.3, speed: 0.02, interval: 3000 }, 
        { threshold: 0.1, speed: 0.05, interval: 1500 }, 
        { threshold: 0.5, speed: 0.01, interval: 5000 }, 
        { threshold: 0.2, speed: 0.08, interval: 800 }    
    ],
    currentPatternIndex: 0,
    lastPatternChangeTime: 0,
    patternChangeInterval: 5000, // Cambiar patrón cada 5 segundos
    lastBackgroundFlashTime: 0, 

    // Propiedades del jugador
    player: {
        body: null,
        radius: 20, // Radio del hitbox físico del jugador
        life: 100,
        score: 0,
        speed: 300, // Velocidad de movimiento en píxeles/segundo
        fireRate: 8, // Balas por segundo
        lastShotTime: 0,
        // UserData adjunto al cuerpo Box2D del jugador
        userData: {type: "player", id: 1, life: 100, radius: 20, isDestroyed: false} 
    },

    // Definición de las propiedades de los diferentes tipos de enemigos
    enemyTypes: [
        { 
            image: () => assets.enemyImage, 
            radius: 15,
            life: 1,
            damage: 25, 
            points: 100, 
            baseSpeed: 50,
            color: 'red' 
        },
        { 
            image: () => assets.enemyImage2, 
            radius: 20, 
            life: 2,    
            damage: 25, 
            points: 200, 
            baseSpeed: 40, 
            color: 'blue' 
        },
        { 
            image: () => assets.enemyImage3, 
            radius: 10, 
            life: 1,
            damage: 25, 
            points: 150,
            baseSpeed: 70, 
            color: 'green'
        }
    ],

    // **********************************************
    // INICIALIZACIÓN Y ESTADOS
    // **********************************************

    /**
     * Inicializa el juego: Canvas, Audio y Física.
     */
    init() {
        loader.init(); // Inicializa AudioContext y Master Gain Node
        this.canvas = document.getElementById('gamecanvas');
        this.context = this.canvas.getContext('2d');
        physics.init(); // Inicializa el mundo de Box2D
        this.world = physics.world;

        this.setState('menu');

        // Prevenir el scroll en dispositivos táctiles durante el juego
        document.addEventListener("touchmove", function(e) {
            if (game.state === 'playing') { e.preventDefault(); }
        }, { passive: false });

        this.initInput();
        
        // Sincronizar el icono de mute del menú con el estado inicial del loader
        const menuMuteButton = document.getElementById('menu-mute-button');
        if (menuMuteButton) {
            menuMuteButton.innerText = loader.isMuted ? '🔇' : '🔊';
        }
    },

    /**
     * Configura los oyentes de eventos para el control del juego (teclado/ratón/táctil).
     */
    initInput() {
        // Manejadores de eventos de teclado (keydown)
        document.addEventListener('keydown', (e) => {
            if (this.state === 'gameover' || this.state === 'menu' || this.state === 'loading') return;
            switch (e.key.toLowerCase()) {
                case 'a': case 'arrowleft': input.left = true; break;
                case 'd': case 'arrowright': input.right = true; break;
                // Prevenir scroll en la barra espaciadora
                case ' ': if (this.state === 'playing') input.fire = true; e.preventDefault(); break; 
                case 'p':
                    this.pauseGame(); 
                    break;
            }
        });

        // Manejadores de eventos de teclado (keyup)
        document.addEventListener('keyup', (e) => {
            if (this.state !== 'playing' && this.state !== 'paused') return;
            switch (e.key.toLowerCase()) {
                case 'a': case 'arrowleft': input.left = false; break;
                case 'd': case 'arrowright': input.right = false; break;
                case ' ': input.fire = false; break;
            }
        });

        // Controles de disparo por click/tap (Mouse y Touch)
        this.canvas.addEventListener('mousedown', () => { if (this.state === 'playing') input.fire = true; });
        this.canvas.addEventListener('mouseup', () => { input.fire = false; });
        
        // Manejo de touch
        this.canvas.addEventListener('touchstart', (e) => { 
            if (this.state === 'playing') { 
                input.fire = true; 
                e.preventDefault(); 
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => { 
            // Debe desactivar el disparo
            if (this.state === 'playing') { 
                input.fire = false; 
                e.preventDefault(); 
            }
        }, { passive: false });
    },

    /**
     * Settea el estado actual del juego y gestiona la visibilidad de las capas de interfaz.
     * @param {string} newState - El nuevo estado del juego ('menu', 'loading', 'playing', 'paused', 'gameover').
     */
    setState(newState) {
        this.state = newState;
        
        input.fire = false; // Desactiva el disparo al cambiar de estado
        
        // Control de visibilidad de las capas principales
        document.getElementById('gamestartscreen').style.display = (newState === 'menu') ? 'flex' : 'none';
        document.getElementById('loadingscreen').style.display = (newState === 'loading') ? 'block' : 'none';
        document.getElementById('gameinterfacescreen').style.display = (newState === 'playing' || newState === 'paused' || newState === 'gameover') ? 'block' : 'none';
        document.getElementById('gameoverscreen').style.display = (newState === 'gameover') ? 'flex' : 'none';
        document.getElementById('pausescreen').style.display = (newState === 'paused') ? 'flex' : 'none';
        
        // Ocultar popups de menú al cambiar de estado
        document.getElementById('controls-popup').style.display = 'none'; 
        document.getElementById('records-popup').style.display = 'none'; 

        // LÓGICA DE AUDIO
        if (this.currentMusicNode) {
            this.currentMusicNode.stop();
            this.currentMusicNode = null;
        }
        
        // CONTROL DE BOTONES DE MUTE
        const menuMuteButton = document.getElementById('menu-mute-button');
        const gameMuteButton = document.getElementById('game-mute-button');

        if (newState === 'menu') {
            if (menuMuteButton) menuMuteButton.style.display = 'block';
            if (gameMuteButton) gameMuteButton.style.display = 'none';
            
            document.getElementById('pause-button').innerText = '||'; 
            this.resumeAudioContext(); // Necesario para desbloquear el AudioContext después de interacción
            
            // Reproducir música del menú si no está muteado
            if (assets.menuMusic && !loader.isMuted) { 
                this.currentMusicNode = playSound(assets.menuMusic, true, 0.4); 
            }
            this.stopLoop(); // Detiene el bucle de juego
            
        } else if (newState === 'playing') {
            if (menuMuteButton) menuMuteButton.style.display = 'none';
            if (gameMuteButton) {
                gameMuteButton.style.display = 'block';
                // Sincroniza el icono de mute del juego
                gameMuteButton.innerText = loader.isMuted ? '🔇' : '🔊';
            }
            
            document.getElementById('pause-button').innerText = '||'; 
            this.startLoop(); // Inicia el bucle de juego
            
            // Si el audio está muteado, el masterGainNode debe reflejarlo
            if (loader.masterGainNode) {
                loader.masterGainNode.gain.value = loader.isMuted ? 0 : 1.0; 
            }
            
        } else if (newState === 'paused') {
            if (menuMuteButton) menuMuteButton.style.display = 'none';
            if (gameMuteButton) gameMuteButton.style.display = 'block';
            
            document.getElementById('pause-button').innerText = '▶'; // Cambia el icono a "Play"
            this.stopLoop(); 
            
        } else if (newState === 'gameover') {
            if (menuMuteButton) menuMuteButton.style.display = 'none';
            if (gameMuteButton) gameMuteButton.style.display = 'none';
            
            playSound(assets.gameOverSound, false, 0.8); 
            this.stopLoop();
            
        } else {
            // Estado 'loading' u otros
            if (menuMuteButton) menuMuteButton.style.display = 'none';
            if (gameMuteButton) gameMuteButton.style.display = 'none';
            this.stopLoop();
        }
    },
    
    /**
     * Función para manejar la pausa/reanudar el juego (toggle).
     */
    pauseGame() {
        if (this.state === 'playing') {
            this.setState('paused');
        } else if (this.state === 'paused') {
            this.setState('playing');
        }
    },

    /**
     * Función para reanudar el AudioContext, ya que puede estar en estado 'suspended'
     * hasta la primera interacción del usuario (requisito de navegadores).
     */
    resumeAudioContext() {
        if (loader.audioContext && loader.audioContext.state !== 'running') {
            loader.audioContext.resume().then(() => {
                console.log("AudioContext reanudado exitosamente.");
            }).catch(error => {
                console.error("Error al intentar reanudar el AudioContext:", error);
            });
        }
    },

    /**
     * Inicia la carga de todos los recursos del juego.
     */
    startLoading() {
        loader.onload = this.startGame.bind(this);
        this.resumeAudioContext(); 
        this.setState('loading');
        
        // Carga de Audio (las promesas resuelven el AudioBuffer en el objeto 'assets')
        loader.loadAudio("assets/audio/menu_music.mp3").then(buffer => assets.menuMusic = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/shoot.mp3").then(buffer => assets.shootSound = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/hit.mp3").then(buffer => assets.hitSound = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/gameover.mp3").then(buffer => assets.gameOverSound = buffer).catch(e => console.error(e));

        // Carga de Imágenes
        assets.playerImage = loader.loadImage("assets/images/player.png");
        assets.enemyImage = loader.loadImage("assets/images/enemy.png"); 
        assets.enemyImage2 = loader.loadImage("assets/images/enemy2.png"); 
        assets.enemyImage3 = loader.loadImage("assets/images/enemy3.png"); 
        assets.bulletImage = loader.loadImage("assets/images/bullet.png");
        assets.backgroundImage = loader.loadImage("assets/images/background.png"); 
    },

    /**
     * Prepara el juego y establece el estado 'playing' después de la carga de recursos.
     */
    startGame() {
        // Reinicio de las propiedades del jugador
        this.player.life = 100;
        this.player.score = 0;
        this.player.userData.life = 100;
        this.player.userData.isDestroyed = false;
        
        // REINICIO DE DIFICULTAD
        this.timeElapsed = 0; 
        this.difficultyFactor = 1.0;
        this.lastDifficultyUpdate = Date.now(); 

        // Reinicio del estado del parpadeo del fondo
        this.backgroundFlashState = 0;
        this.backgroundFlashOpacity = 1.0; 
        this.lastBackgroundFlashTime = Date.now();
        this.currentPatternIndex = 0; 
        this.lastPatternChangeTime = Date.now();


        // Limpiar enemigos y balas anteriores (destruir cuerpos de Box2D)
        for (const body of gameEntities.keys()) { 
            this.world.DestroyBody(body); 
        }
        gameEntities.clear();
        spawnTimer = 0;

        // Recrear y configurar el cuerpo del jugador
        if (this.player.body) {
            this.world.DestroyBody(this.player.body);
        }

        this.player.body = physics.createCircleBody(
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.player.radius,
            this.player.userData // Adjuntar el userData del player
        );
        this.player.body.SetLinearDamping(0); // Sin amortiguación lineal (movimiento constante)
        this.player.body.SetAngularDamping(0); // Sin amortiguación angular (sin rotación por fricción)
        this.player.body.SetSleepingAllowed(false); // Mantener al jugador activo

        // Posicionar al jugador en el centro inferior
        this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(this.canvas.width / 2), physics.pixelsToMeters(this.canvas.height - 50)));

        lastUpdateTime = Date.now();
        
        // Asegurar que el master gain node refleje el estado de mute
        if (loader.masterGainNode) {
            loader.masterGainNode.gain.value = loader.isMuted ? 0 : 1.0; 
        }
        
        this.setState('playing');
    },

    /**
     * Cambia el estado a 'menu'.
     */
    goToMenu() {
        this.setState('menu');
    },

    // **********************************************
    // GAME LOOP Y FÍSICA
    // **********************************************

    /**
     * Inicia el bucle unificado de dibujo y lógica (requestAnimationFrame).
     */
    startLoop() {
        if (this.animationFrameId) return; 
        
        lastUpdateTime = Date.now(); 
        lastFPSTime = Date.now();    
        this.animationFrameId = requestAnimationFrame(this.drawLoop.bind(this));
    },

    /**
     * Detiene el bucle de requestAnimationFrame.
     */
    stopLoop() {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    },
    
    // **********************************************
    // MECÁNICAS DE JUEGO (SHOOTER)
    // **********************************************

    /**
     * Crea un enemigo en una posición aleatoria superior con velocidad descendente.
     */
    spawnEnemy() {
        const canvasWidth = this.canvas.width;
        
        // Selecciona un tipo de enemigo aleatorio
        const enemyType = this.enemyTypes[Math.floor(Math.random() * this.enemyTypes.length)];

        const enemyRadius = enemyType.radius;

        // Posición de spawn aleatoria en el ancho, cerca de la parte superior
        const spawnX = Math.random() * (canvasWidth - 2 * enemyRadius) + enemyRadius;
        const spawnY = 10;

        // APLICACIÓN DEL FACTOR DE DIFICULTAD A LA VELOCIDAD
        const enemySpeed = enemyType.baseSpeed * this.difficultyFactor; 
        const enemySpeedMeters = physics.pixelsToMeters(enemySpeed);

        const userData = {
            type: "enemy",
            id: Date.now(), 
            life: enemyType.life,
            damage: enemyType.damage, 
            points: enemyType.points, 
            radius: enemyType.radius,
            isDestroyed: false, 
            // Almacenar el índice para la lógica de dibujo
            enemyTypeIndex: this.enemyTypes.indexOf(enemyType) 
        };

        const enemyBody = physics.createCircleBody(spawnX, spawnY, enemyRadius, userData);
        enemyBody.SetFixedRotation(true);
        // Aplica velocidad hacia abajo (eje Y positivo)
        enemyBody.SetLinearVelocity(new b2Vec2(0, enemySpeedMeters));

        // Registrar la entidad en el Map
        gameEntities.set(enemyBody, userData);
    },

    /**
     * Crea una bala disparada por el jugador.
     */
    fireBullet() {
        if (!this.player.body) return;
        
        // Reproducción de sonido
        playSound(assets.shootSound, false, 0.5);

        const playerPos = this.player.body.GetPosition();

        // Calcular posición inicial de la bala justo por encima del jugador
        const startX = physics.metersToPixels(playerPos.x);
        const startY = physics.metersToPixels(playerPos.y) - this.player.radius - 5;

        const bulletRadius = 3;
        const bulletSpeed = 600;
        const bulletSpeedMeters = physics.pixelsToMeters(bulletSpeed);

        const userData = {
            type: "bullet", 
            isPlayerBullet: true, 
            damage: 1, 
            radius: bulletRadius,
            isDestroyed: false 
        };

        const bulletBody = physics.createCircleBody(startX, startY, bulletRadius, userData);

        // Aplica velocidad hacia arriba (eje Y negativo)
        bulletBody.SetLinearVelocity(new b2Vec2(0, -bulletSpeedMeters));

        // Registrar la entidad en el Map
        gameEntities.set(bulletBody, userData);
    },

    /**
     * Lógica principal de contacto de colisiones (llamado desde physics.js).
     * @param {object} bodyA - El UserData del cuerpo A.
     * @param {object} bodyB - El UserData del cuerpo B.
     */
    handleContact(bodyA, bodyB) {
        let bullet, enemy, player;

        // Si alguna entidad ya está marcada para ser destruida, IGNORAR el contacto.
        if (bodyA.isDestroyed || bodyB.isDestroyed) {
            return;
        }

        // 1. Identificación de los tipos de colisión
        if (bodyA.type === 'bullet' && bodyB.type === 'enemy') {
            bullet = bodyA; enemy = bodyB;
        } else if (bodyB.type === 'bullet' && bodyA.type === 'enemy') {
            bullet = bodyB; enemy = bodyA;
        } else if (bodyA.type === 'enemy' && bodyB.type === 'player') {
            enemy = bodyA; player = bodyB;
        } else if (bodyB.type === 'enemy' && bodyA.type === 'player') {
            enemy = bodyB; player = bodyA;
        }

        // 2. Colisión Bala vs. Enemigo
        if (bullet && enemy) {
            // Marcar para destrucción (serán eliminados en cleanUpEntities)
            bullet.isDestroyed = true; 
            enemy.isDestroyed = true; 
            // Sumar puntos
            const enemyType = game.enemyTypes.find(type => type.points === enemy.points);
            this.player.score += enemy.points;
            
            playSound(assets.hitSound, false, 0.7); 
        }

        // 3. Colisión Enemigo vs. Jugador
        if (enemy && player) {
            // Aplicar daño al jugador y destruir al enemigo
            player.life -= enemy.damage; 
            enemy.isDestroyed = true; 
            
            playSound(assets.hitSound, false, 1.0);
        }

        // La limpieza real (destrucción de cuerpos Box2D) ocurre al final del drawLoop.
    },

    /**
     * Elimina entidades marcadas para destrucción o que han salido de los límites de la pantalla.
     */
    cleanUpEntities() {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const bodiesToDestroy = [];

        // Iterar sobre el Map de entidades
        for (const [body, userData] of gameEntities.entries()) {
            
            if (userData.type === 'player') {
                continue;
            }

            const pos = body.GetPosition();
            const x = physics.metersToPixels(pos.x);
            const y = physics.metersToPixels(pos.y);
            const r = userData.radius;
            
            // La bala necesita un límite superior extendido para evitar limpieza prematura
            const isBullet = userData.type === 'bullet';
            const topLimit = isBullet ? -50 : -r; 
            
            const fueraDeLimites = (x < -r || x > canvasWidth + r || y < topLimit || y > canvasHeight + r);
            
            // Bandera de destrucción activa o vida terminada
            const vidaTerminada = userData.isDestroyed || (userData.life !== undefined && userData.life <= 0);

            if (fueraDeLimites || vidaTerminada) {
                bodiesToDestroy.push(body);
            }
        }

        // Destrucción de cuerpos en Box2D y eliminación del Map
        for (const body of bodiesToDestroy) {
            // Verifica que el cuerpo siga en el mundo antes de intentar destruirlo (seguridad extra)
            if (body.GetWorld()) { 
                this.world.DestroyBody(body);
            }
            gameEntities.delete(body);
        }
    },

    // **********************************************
    // GAME LOOP (requestAnimationFrame)
    // **********************************************

    /**
     * Bucle unificado de dibujo y lógica (principal loop del juego).
     */
    drawLoop() {
        if (this.state !== 'playing' && this.state !== 'paused') { 
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            return;
        }

        const now = Date.now();
        // CÁLCULO DE TIMESTEP PARA MOVIMIENTO BASADO EN EL TIEMPO
        let timeStep = (now - lastUpdateTime) / 1000; // timeStep en segundos
        lastUpdateTime = now;
        
        // Limitar el timeStep (anti-lag spike) para evitar que la física se vuelva inestable
        if (timeStep > (1/10)) { 
            timeStep = 1/10;
        }

        // ==============================================
        //           LÓGICA DEL JUEGO (Solo si está 'playing')
        // ==============================================
        if (this.state === 'playing' && this.player.body) {
            
            // 1. LÓGICA DE DIFICULTAD PROGRESIVA
            this.timeElapsed += timeStep * 1000;
            
            if (this.timeElapsed >= this.difficultyIncreaseTime) {
                this.difficultyFactor += this.difficultyIncreaseRate;
                this.timeElapsed -= this.difficultyIncreaseTime; 
            }


            // 2. Control de Aparición de Enemigos
            spawnTimer += timeStep * 1000; 

            // Intervalo de spawn se reduce con la dificultad
            const currentSpawnInterval = Math.max(200, spawnInterval / this.difficultyFactor); 

            if (spawnTimer >= currentSpawnInterval) {
                this.spawnEnemy();
                spawnTimer = spawnTimer % currentSpawnInterval; 
            }


            // 3. Movimiento del Jugador
            let vx = 0;
            const speedMeters = physics.pixelsToMeters(this.player.speed);

            if (input.left) vx -= speedMeters;
            if (input.right) vx += speedMeters;

            // Aplica la velocidad calculada
            this.player.body.SetLinearVelocity(new b2Vec2(vx, 0));

            // Aplicar límites de pantalla
            const playerPos = this.player.body.GetPosition();
            const playerXPixels = physics.metersToPixels(playerPos.x);
            const minX = this.player.radius;
            const maxX = this.canvas.width - this.player.radius;

            if (playerXPixels < minX) {
                this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(minX), playerPos.y));
                this.player.body.SetLinearVelocity(new b2Vec2(0, 0)); // Detiene el movimiento al chocar
            } else if (playerXPixels > maxX) {
                this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(maxX), playerPos.y));
                this.player.body.SetLinearVelocity(new b2Vec2(0, 0)); // Detiene el movimiento al chocar
            }

            // 4. Disparo (controlado por fireRate)
            if (input.fire && now > this.player.lastShotTime) {
                this.fireBullet();
                // Calcula el tiempo del próximo disparo
                this.player.lastShotTime = now + (1000 / this.player.fireRate);
            }

            // 5. Simulación de física (usando el timeStep variable)
            physics.step(timeStep);

            // 6. Lógica de limpieza y estado
            this.cleanUpEntities();
            this.updateGameLogic();
        } 
        // ==============================================
        //           FIN LÓGICA DEL JUEGO
        // ==============================================


        // LÓGICA DE CÁLCULO DE FPS
        frameCount++;
        const delta = now - lastFPSTime;
        if (delta >= 1000) {
            fpsMeter = Math.round((frameCount * 1000) / delta);
            frameCount = 0;
            lastFPSTime = now;
        }
        // FIN LÓGICA DE CÁLCULO DE FPS


        // LÓGICA DE CAMBIO Y ESTADO DE PARPADEO DEL FONDO (Efecto visual)
        if (now - this.lastPatternChangeTime > this.patternChangeInterval) {
            this.currentPatternIndex = (this.currentPatternIndex + 1) % this.backgroundFlashPatterns.length;
            this.lastPatternChangeTime = now;
            this.backgroundFlashState = 0; 
        }

        const currentPattern = this.backgroundFlashPatterns[this.currentPatternIndex];

        if (this.backgroundFlashState === 0) {
            if (now - this.lastBackgroundFlashTime > currentPattern.interval) {
                this.backgroundFlashState = 1;
                this.backgroundFlashOpacity = currentPattern.threshold;
                this.lastBackgroundFlashTime = now;
            }
        } else if (this.backgroundFlashState === 1) {
            this.backgroundFlashOpacity += currentPattern.speed;
            if (this.backgroundFlashOpacity >= 1.0) {
                this.backgroundFlashOpacity = 1.0;
                this.backgroundFlashState = 2;
            }
        } else if (this.backgroundFlashState === 2) {
            this.backgroundFlashOpacity -= currentPattern.speed;
            if (this.backgroundFlashOpacity <= currentPattern.threshold) {
                this.backgroundFlashOpacity = currentPattern.threshold;
                this.backgroundFlashState = 0;
            }
        }

        // ==============================================
        //           DIBUJO
        // ==============================================

        // 1. DIBUJO DEL FONDO
        this.context.fillStyle = '#0a0a20'; 
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (assets.backgroundImage && assets.backgroundImage.complete) {
            this.context.save(); 
            this.context.globalAlpha = this.backgroundFlashOpacity; // Aplica la opacidad del parpadeo
            this.context.drawImage(assets.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
            this.context.restore(); // Restaura el globalAlpha a 1.0
        }

        // 2. Dibujar entidades del juego
        this.drawPlayer();
        this.drawEntities();
        this.drawHUD();
        
        // 3. Llamada recursiva para el siguiente frame
        this.animationFrameId = requestAnimationFrame(this.drawLoop.bind(this));
    },

    /**
     * Dibuja las entidades (balas/enemigos) que están en el Map.
     */
    drawEntities() {
        for (const [body, userData] of gameEntities.entries()) {
            
            if (userData.type === 'player') {
                continue;
            }

            const pos = body.GetPosition();
            const x = physics.metersToPixels(pos.x);
            const y = physics.metersToPixels(pos.y);
            const r = userData.radius;

            let image;
            let fallbackColor;

            if (userData.type === 'bullet') {
                image = assets.bulletImage;
                fallbackColor = 'yellow'; 
            } else if (userData.type === 'enemy') {
                // Selecciona la imagen correcta según el enemyTypeIndex
                const enemyType = game.enemyTypes[userData.enemyTypeIndex]; 
                image = enemyType ? enemyType.image() : assets.enemyImage; 
                fallbackColor = enemyType ? enemyType.color : 'red'; 
            } else {
                continue; 
            }

            if (image && image.complete) {
                // Dibuja la imagen centrada
                this.context.drawImage(image, x - r, y - r, r * 2, r * 2);
            } else {
                // Fallback: Dibujo de círculo si la imagen no se carga
                this.context.fillStyle = fallbackColor;
                this.context.beginPath();
                this.context.arc(x, y, r, 0, Math.PI * 2, true);
                this.context.fill();
            }
        }
    },

    /**
     * Dibuja la nave del jugador.
     */
    drawPlayer() {
        if (!this.player.body) return;

        const pos = this.player.body.GetPosition();

        const x = physics.metersToPixels(pos.x);
        const y = physics.metersToPixels(pos.y);
        const r = this.player.radius; 

        if (assets.playerImage && assets.playerImage.complete) {
            const imageScaleFactor = 1.5; // Escala visual de la imagen respecto al hitbox

            const scaledWidth = (r * 2) * imageScaleFactor;
            const scaledHeight = (r * 2) * imageScaleFactor;

            // Ajuste para centrar la imagen visualmente ampliada sobre el cuerpo físico
            const offsetX = (scaledWidth - (r * 2)) / 2;
            const offsetY = (scaledHeight - (r * 2)) / 2;

            this.context.drawImage(
                assets.playerImage,
                x - r - offsetX, 
                y - r - offsetY, 
                scaledWidth,     
                scaledHeight     
            );
        }
    },

    /**
     * Actualiza la información del HUD (puntuación, vida, FPS).
     */
    drawHUD() {
        document.getElementById('score').innerText = `SCORE: ${this.player.score}`;
        document.getElementById('life').innerText = `LIFE: ${this.player.userData.life}`;
        document.getElementById('fps-counter').innerText = `FPS: ${fpsMeter}`;
    },

    /**
     * Contiene la lógica de fin de partida y guardado de récords.
     */
    updateGameLogic() {
        if (this.player.userData.life <= 0) {
            
            // LÓGICA DE RÉCORDS: Comparar y guardar
            if (this.player.score > highScore) {
                highScore = this.player.score;
                localStorage.setItem('spaceWarHighScore', highScore);
            }
            
            this.setState('gameover');
            document.getElementById('final-score').innerText = `Puntuación Final: ${this.player.score}`;
        }
    },

    /**
     * Ajusta el escalado del contenedor del juego a la ventana del navegador (responsividad).
     */
    resize() {
        const maxWidth = window.innerWidth;
        const maxHeight = window.innerHeight;

        // Calcula la escala manteniendo el aspecto 640x480
        const scale = Math.min(maxWidth / 640, maxHeight / 480);

        const gameContainer = document.getElementById("gamecontainer");
        gameContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
        this.scale = scale;
    },

    /**
     * Alterna el estado de mute global y actualiza el icono del botón correcto.
     * @param {string} location - 'menu' o 'game' para saber qué botón actualizar.
     */
    toggleMute(location) {
        loader.isMuted = !loader.isMuted; 
        
        const currentButton = location === 'menu' ? 
            document.getElementById('menu-mute-button') : 
            document.getElementById('game-mute-button');
        
        // 1. Actualizar icono del botón visible
        if (currentButton) {
            currentButton.innerText = loader.isMuted ? '🔇' : '🔊';
        }
        
        // 2. Controlar la ganancia maestra (muta o desmuta el audio global)
        if (loader.masterGainNode) {
            loader.masterGainNode.gain.value = loader.isMuted ? 0 : 1.0; 
        }
        
        // 3. Controlar la música del menú (debe detenerse/iniciarse si se está en el menú)
        if (this.state === 'menu') {
            if (loader.isMuted) {
                if (this.currentMusicNode) {
                    this.currentMusicNode.stop();
                    this.currentMusicNode = null;
                }
            } else if (assets.menuMusic) {
                 this.currentMusicNode = playSound(assets.menuMusic, true, 0.4); 
            }
        }
    },
    
    // **********************************************
    // FUNCIONES DE PANELES (Controles y Récords)
    // **********************************************
    
    /**
     * Muestra la ventana emergente de controles.
     */
    showControls: function() {
        if (this.state === 'menu') {
            document.getElementById("controls-popup").style.display = 'flex';
        }
    },

    /**
     * Oculta la ventana emergente de controles.
     */
    hideControls: function() {
        document.getElementById("controls-popup").style.display = 'none';
    },

    /**
     * Muestra la ventana emergente de récords y actualiza la puntuación más alta.
     */
    showRecords: function() {
        if (this.state === 'menu') {
            // Carga la puntuación más alta del localStorage
            document.getElementById('high-score-display').innerText = highScore;
            document.getElementById("records-popup").style.display = 'flex';
        }
    },

    /**
     * Oculta la ventana emergente de récords.
     */
    hideRecords: function() {
        document.getElementById("records-popup").style.display = 'none';
    }
};