// game.js (CÓDIGO CORREGIDO)

// Variables para el control de tiempo y entrada
let lastUpdateTime = Date.now();
let input = { left: false, right: false, fire: false }; // Control de entrada (teclado/ratón/táctil)
let assets = { // Contenedor de recursos cargados
    playerImage: null, 
    enemyImage: null,      // Tu enemigo rojo original
    enemyImage2: null,     // Nueva nave enemiga 1
    enemyImage3: null,     // Nueva nave enemiga 2
    bulletImage: null,
    backgroundImage: null,
    
    // NUEVO: Recursos de Audio
    menuMusic: null,
    shootSound: null,
    hitSound: null,
    gameOverSound: null,
}; 
// Usaremos un Map para mapear el Box2D body (key) con sus metadatos de juego (value)
// Esto es más limpio que almacenar metadata directamente en el body o en un array simple.
let gameEntities = new Map(); // Mapa de cuerpos físicos: Body -> UserData. Mantiene los cuerpos vivos.

// Variables para la lógica de oleadas/spawn (simplificadas)
let spawnTimer = 0;
const spawnInterval = 1000; // Intervalo base: Un enemigo cada 1000ms (1 segundo)

const game = {  
    // Propiedades del juego
    canvas: null,
    context: null,
    scale: 1, 
    state: 'menu',
    animationFrameId: null, // ID para requestAnimationFrame (Draw loop)
    logicInterval: null, // ID para setInterval (Logic loop)
    animationTime: 50, // 20 FPS para la lógica (1000ms / 20 = 50ms)
    
    // NUEVO: Referencia al nodo de la música del menú para poder detenerla
    currentMusicNode: null, 
    
    // PROPIEDADES PARA CONTROL DE DIFICULTAD PROGRESIVA
    timeElapsed: 0, // Tiempo total jugado en milisegundos
    difficultyFactor: 1.0, // Multiplicador de velocidad y frecuencia (1.0 = base)
    difficultyIncreaseRate: 0.15, // Aumentar velocidad/frecuencia 15%
    difficultyIncreaseTime: 4000, // Cada 4 segundos
    lastDifficultyUpdate: 0, 

    // PROPIEDADES PARA EL PARPADEO DEL FONDO
    backgroundFlashState: 0, // 0 = sin parpadeo, 1 = aumentando opacidad, 2 = disminuyendo opacidad
    backgroundFlashOpacity: 0.3, // Opacidad inicial, se ajustará por el patrón
    backgroundFlashPatterns: [
        { threshold: 0.3, speed: 0.02, interval: 3000 }, // Patrón 1: parpadeo suave
        { threshold: 0.1, speed: 0.05, interval: 1500 }, // Patrón 2: parpadeo rápido
        { threshold: 0.5, speed: 0.01, interval: 5000 }, // Patrón 3: parpadeo lento
        { threshold: 0.2, speed: 0.08, interval: 800 }    // Patrón 4: parpadeo nervioso
    ],
    currentPatternIndex: 0,
    lastPatternChangeTime: 0,
    patternChangeInterval: 5000, // Cambiar cada 5 segundos
    lastBackgroundFlashTime: 0, // Última vez que se inició un ciclo de parpadeo (para el patrón actual)

    // Propiedades del jugador
    player: {
        body: null,
        radius: 20, // Radio del hitbox físico del jugador
        life: 100,
        score: 0,
        speed: 300, 
        fireRate: 8, 
        lastShotTime: 0,
        // Usaremos este objeto como UserData para el Box2D body
        userData: {type: "player", id: 1, life: 100, radius: 20, isDestroyed: false} 
    },

    // NUEVO: Definición de las propiedades de los diferentes tipos de enemigos
    enemyTypes: [
        { 
            image: () => assets.enemyImage, // Función para obtener la imagen
            radius: 15,
            life: 1,
            damage: 25, // Daño de 25
            points: 100, // Puntos de 100
            baseSpeed: 50,
            color: 'red' // Para el fallback si la imagen no carga
        },
        { 
            image: () => assets.enemyImage2, 
            radius: 20, // Un poco más grande
            life: 2,    // Más resistente
            damage: 25, // Daño de 25
            points: 200, // Da más puntos
            baseSpeed: 40, // Un poco más lento que el original, para diferenciar
            color: 'blue' 
        },
        { 
            image: () => assets.enemyImage3, 
            radius: 10, // Más pequeño y quizás más rápido
            life: 1,
            damage: 25, // Daño de 25
            points: 150,
            baseSpeed: 70, // Más rápido
            color: 'green'
        }
    ],

    // **********************************************
    // INICIALIZACIÓN Y ESTADOS
    // **********************************************

    init() {
        loader.init(); // Inicializa AudioContext en estado 'suspended'

        this.canvas = document.getElementById('gamecanvas');
        this.context = this.canvas.getContext('2d');

        physics.init(); // Inicializa el mundo de Box2D
        this.world = physics.world;

        this.setState('menu');

        document.addEventListener("touchmove", function(e) {
            // Prevenir el scroll en dispositivos táctiles mientras se juega
            if (game.state === 'playing') { e.preventDefault(); }
        }, { passive: false });

        this.initInput();
    },

    // Manejo de entrada
    initInput() {
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

        document.addEventListener('keyup', (e) => {
            if (this.state !== 'playing' && this.state !== 'paused') return;
            switch (e.key.toLowerCase()) {
                case 'a': case 'arrowleft': input.left = false; break;
                case 'd': case 'arrowright': input.right = false; break;
                case ' ': input.fire = false; break;
            }
        });

        // Controles de disparo por click/tap
        this.canvas.addEventListener('mousedown', () => { if (this.state === 'playing') input.fire = true; });
        this.canvas.addEventListener('mouseup', () => { input.fire = false; });
        
        // CORRECCIÓN: Manejar touchstart y touchend correctamente
        this.canvas.addEventListener('touchstart', (e) => { 
            if (this.state === 'playing') { 
                input.fire = true; 
                e.preventDefault(); 
            }
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => { 
            // CRÍTICO: Debe desactivar el disparo
            if (this.state === 'playing') { 
                input.fire = false; 
                e.preventDefault(); 
            }
        }, { passive: false });
    },

    // Settea el estado y controla la visibilidad de las capas
    setState(newState) {
        this.state = newState;
        
        // CRÍTICO: Reiniciar la entrada de disparo al cambiar de estado para evitar disparos fantasma
        input.fire = false; 
        
        document.getElementById('gamestartscreen').style.display = (newState === 'menu') ? 'flex' : 'none';
        document.getElementById('loadingscreen').style.display = (newState === 'loading') ? 'block' : 'none';
        
        document.getElementById('gameinterfacescreen').style.display = (newState === 'playing' || newState === 'paused' || newState === 'gameover') ? 'block' : 'none';
        
        document.getElementById('gameoverscreen').style.display = (newState === 'gameover') ? 'flex' : 'none';
        
        // Visibilidad del panel de pausa.
        document.getElementById('pausescreen').style.display = (newState === 'paused') ? 'flex' : 'none';

        // Ocultar la ventana de controles al cambiar de estado
        document.getElementById('controls-popup').style.display = 'none'; 

        // NUEVA LÓGICA DE AUDIO
        if (this.currentMusicNode) {
            this.currentMusicNode.stop();
            this.currentMusicNode = null;
        }

        if (newState === 'menu') {
            document.getElementById('pause-button').innerText = '||'; 
            // CRÍTICO: Intentar reanudar el contexto de audio antes de reproducir la música del menú
            this.resumeAudioContext(); 
            if (assets.menuMusic) { 
                this.currentMusicNode = playSound(assets.menuMusic, true, 0.4); // Reproducir música del menú en bucle
            }
            this.stopLoop();
        } else if (newState === 'playing') {
            document.getElementById('pause-button').innerText = '||'; 
            this.startLoop();
        } else if (newState === 'paused') {
            document.getElementById('pause-button').innerText = '▶'; 
            this.stopLoop(); 
        } else if (newState === 'gameover') {
            playSound(assets.gameOverSound, false, 0.8); // Reproducir sonido de Game Over
            this.stopLoop();
        } else {
            this.stopLoop();
        }
    },
    
    // Función para manejar la pausa/reanudar (toggle)
    pauseGame() {
        if (this.state === 'playing') {
            this.setState('paused');
        } else if (this.state === 'paused') {
            this.setState('playing');
        }
    },

    /**
     * Función para reanudar el AudioContext después de la interacción del usuario.
     */
    resumeAudioContext() {
        if (loader.audioContext && loader.audioContext.state !== 'running') {
            // Intentar reanudar el contexto de audio
            loader.audioContext.resume().then(() => {
                console.log("AudioContext reanudado exitosamente.");
            }).catch(error => {
                console.error("Error al intentar reanudar el AudioContext:", error);
            });
        }
    },

    // Inicia la carga de recursos (CORREGIDA PARA EVITAR BLOQUEOS)
    startLoading() {
        // CRÍTICO: Configurar el callback de finalización PRIMERO.
        loader.onload = this.startGame.bind(this);
        
        // Reanudar el contexto de audio aquí, ligado al evento de click/tap del usuario
        this.resumeAudioContext(); 
        
        this.setState('loading');
        
        // Inicializar la carga de audio (solo se necesita iniciar las promesas, el loader.js gestiona el conteo)
        loader.loadAudio("assets/audio/menu_music.mp3").then(buffer => assets.menuMusic = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/shoot.mp3").then(buffer => assets.shootSound = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/hit.mp3").then(buffer => assets.hitSound = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/gameover.mp3").then(buffer => assets.gameOverSound = buffer).catch(e => console.error(e));

        // Inicializar la carga de imágenes
        assets.playerImage = loader.loadImage("assets/images/player.png");
        assets.enemyImage = loader.loadImage("assets/images/enemy.png"); // Tu enemigo original
        assets.enemyImage2 = loader.loadImage("assets/images/enemy2.png"); // Cargar la nueva imagen 1
        assets.enemyImage3 = loader.loadImage("assets/images/enemy3.png"); // Cargar la nueva imagen 2
        assets.bulletImage = loader.loadImage("assets/images/bullet.png");
        assets.backgroundImage = loader.loadImage("assets/images/background.png"); // Cargar la imagen de fondo
    },

    // Empieza el juego (callback del loader)
    startGame() {
        // Vida inicial del jugador de 100
        this.player.life = 100;
        this.player.score = 0;
        this.player.userData.life = 100;
        this.player.userData.isDestroyed = false;
        
        // REINICIO DE DIFICULTAD
        this.timeElapsed = 0; 
        this.difficultyFactor = 1.0;
        this.lastDifficultyUpdate = Date.now(); 

        // Restablecer el estado del parpadeo del fondo a un patrón inicial
        this.backgroundFlashState = 0;
        this.backgroundFlashOpacity = 1.0; // Inicia totalmente visible
        this.lastBackgroundFlashTime = Date.now();
        this.currentPatternIndex = 0; // Inicia con el primer patrón
        this.lastPatternChangeTime = Date.now();


        // Limpiar enemigos y balas anteriores (destruir cuerpos de Box2D)
        // CRÍTICO: Iterar sobre el Map y destruir todos los cuerpos.
        for (const body of gameEntities.keys()) { 
            this.world.DestroyBody(body); 
        }
        gameEntities.clear();
        spawnTimer = 0;

        // Recrear y configurar el cuerpo del jugador
        if (this.player.body) {
            this.world.DestroyBody(this.player.body);
        }

        // El Player Body se crea y su userData es la referencia, la cual será modificada
        this.player.body = physics.createCircleBody(
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.player.radius,
            this.player.userData // Adjuntar el userData del player
        );
        this.player.body.SetLinearDamping(0);
        this.player.body.SetAngularDamping(0);
        this.player.body.SetSleepingAllowed(false); 

        // Posicionar al jugador en el centro inferior
        this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(this.canvas.width / 2), physics.pixelsToMeters(this.canvas.height - 50)));

        lastUpdateTime = Date.now();
        this.setState('playing');
    },

    // Lógica para volver al menú
    goToMenu() {
        this.setState('menu');
    },

    // **********************************************
    // GAME LOOP Y FÍSICA
    // **********************************************

    // Inicia bucles
    startLoop() {
        if (this.logicInterval) return; 
        
        // Bucle de lógica (Control de juego y física)
        this.logicInterval = setInterval(this.logicLoop.bind(this), this.animationTime);
        // Bucle de dibujo (Renderizado)
        this.animationFrameId = requestAnimationFrame(this.drawLoop.bind(this));
    },

    // Detiene bucles
    stopLoop() {
        clearInterval(this.logicInterval);
        this.logicInterval = null;
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    },

    // Llama a la lógica principal (20 veces/segundo)
    logicLoop() {
        if (this.state !== 'playing' || !this.player.body) return;

        const now = Date.now();
        let timeStep = (now - lastUpdateTime) / 1000;
        lastUpdateTime = now;
        
        // Limitar el timeStep (anti-lag spike)
        if (timeStep > (1/10)) { 
            timeStep = 1/10;
        }

        // 1. LÓGICA DE DIFICULTAD PROGRESIVA
        this.timeElapsed += timeStep * 1000;
        
        if (this.timeElapsed >= this.difficultyIncreaseTime) {
            // Incrementar el factor de dificultad (velocidad y frecuencia) en 15%
            this.difficultyFactor += this.difficultyIncreaseRate;
            // Restar el intervalo para garantizar que el progreso sea constante
            this.timeElapsed -= this.difficultyIncreaseTime; 
        }


        // 2. Control de Aparición de Enemigos
        spawnTimer += game.animationTime;

        // Reducir el intervalo de spawn con el tiempo
        const currentSpawnInterval = Math.max(200, spawnInterval / this.difficultyFactor); 

        if (spawnTimer >= currentSpawnInterval) {
            this.spawnEnemy();
            spawnTimer = 0;
        }


        // 3. Movimiento del Jugador
        let vx = 0;
        const speedMeters = physics.pixelsToMeters(this.player.speed);

        if (input.left) vx -= speedMeters;
        if (input.right) vx += speedMeters;

        this.player.body.SetLinearVelocity(new b2Vec2(vx, 0));

        // Aplicar límites de pantalla
        const playerPos = this.player.body.GetPosition();
        const playerXPixels = physics.metersToPixels(playerPos.x);
        const minX = this.player.radius;
        const maxX = this.canvas.width - this.player.radius;

        // Límite Izquierdo y Derecho
        if (playerXPixels < minX) {
            this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(minX), playerPos.y));
            this.player.body.SetLinearVelocity(new b2Vec2(0, 0));
        } else if (playerXPixels > maxX) {
            this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(maxX), playerPos.y));
            this.player.body.SetLinearVelocity(new b2Vec2(0, 0));
        }

        // 4. Disparo
        if (input.fire && now > this.player.lastShotTime) {
            this.fireBullet();
            this.player.lastShotTime = now + (1000 / this.player.fireRate);
        }

        // 5. Simulación de física
        physics.step(timeStep);

        // 6. Lógica de limpieza y estado (Al final del ciclo de física)
        this.cleanUpEntities();
        this.updateGameLogic();
    },

    // **********************************************
    // MECÁNICAS DE JUEGO (SHOOTER)
    // **********************************************

    // Crea un enemigo (MODIFICADO para selección aleatoria)
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
            id: Date.now(), // ID único
            life: enemyType.life,
            damage: enemyType.damage, // Usa el daño restaurado (25)
            points: enemyType.points, // Usa los puntos restaurados (100)
            radius: enemyType.radius,
            isDestroyed: false, // Flag para manejo de colisiones
            // Almacenar el índice del tipo de enemigo para poder dibujar la imagen correcta
            enemyTypeIndex: this.enemyTypes.indexOf(enemyType) 
        };

        const enemyBody = physics.createCircleBody(spawnX, spawnY, enemyRadius, userData);
        enemyBody.SetFixedRotation(true);
        enemyBody.SetLinearVelocity(new b2Vec2(0, enemySpeedMeters));

        // CRÍTICO: Usar el Map para registrar la entidad
        gameEntities.set(enemyBody, userData);
    },

    // Lógica de disparo
    fireBullet() {
        if (!this.player.body) return;
        
        // Reproducción de sonido: Solamente aquí, ligado al fireRate
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
            isDestroyed: false // Flag para manejo de colisiones
        };

        const bulletBody = physics.createCircleBody(startX, startY, bulletRadius, userData);

        // Aplica velocidad hacia arriba
        bulletBody.SetLinearVelocity(new b2Vec2(0, -bulletSpeedMeters));

        // CRÍTICO: Usar el Map para registrar la entidad
        gameEntities.set(bulletBody, userData);
    },

    /**
     * Lógica principal de contacto de colisiones (llamado desde physics.js)
     * @param {object} bodyA - El UserData del cuerpo A.
     * @param {object} bodyB - El UserData del cuerpo B.
     */
    handleContact(bodyA, bodyB) {
        let bullet, enemy, player;

        // CRÍTICO: Si alguna entidad ya está marcada para ser destruida, IGNORAR el contacto.
        if (bodyA.isDestroyed || bodyB.isDestroyed) {
            return;
        }

        // Identificación de los tipos de colisión
        if (bodyA.type === 'bullet' && bodyB.type === 'enemy') {
            bullet = bodyA; enemy = bodyB;
        } else if (bodyB.type === 'bullet' && bodyA.type === 'enemy') {
            bullet = bodyB; enemy = bodyA;
        } else if (bodyA.type === 'enemy' && bodyB.type === 'player') {
            enemy = bodyA; player = bodyB;
        } else if (bodyB.type === 'enemy' && bodyA.type === 'player') {
            enemy = bodyB; player = bodyA;
        }

        // Colisión Bala vs. Enemigo
        if (bullet && enemy) {
            // Marcar para destrucción y aplicar efectos
            bullet.isDestroyed = true; 
            enemy.isDestroyed = true; 
            // Usa los puntos definidos en el tipo de enemigo (restaurado a 100 para el básico)
            this.player.score += enemy.points;
            
            // SONIDO DE IMPACTO DE BALA
            playSound(assets.hitSound, false, 0.7); 
        }

        // Colisión Enemigo vs. Jugador
        if (enemy && player) {
            // Usa el daño definido en el tipo de enemigo (restaurado a 25)
            player.life -= enemy.damage; 
            enemy.isDestroyed = true; 
            
            // SONIDO DE DAÑO AL JUGADOR
            playSound(assets.hitSound, false, 1.0);
        }

        // La limpieza se realiza al final de logicLoop.
    },

    // Elimina entidades marcadas o fuera de pantalla
    cleanUpEntities() {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const bodiesToDestroy = [];

        // CRÍTICO: Iterar sobre el Map.
        for (const [body, userData] of gameEntities.entries()) {
            
            // Omitir al jugador.
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
    // DIBUJO Y VISUALIZACIÓN
    // **********************************************

    drawLoop() {
        if (this.state !== 'playing' && this.state !== 'paused') { 
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            return;
        }

        const now = Date.now();

        // LÓGICA DE CAMBIO Y ESTADO DE PARPADEO DEL FONDO
        if (now - this.lastPatternChangeTime > this.patternChangeInterval) {
            this.currentPatternIndex = (this.currentPatternIndex + 1) % this.backgroundFlashPatterns.length;
            this.lastPatternChangeTime = now;
            this.backgroundFlashState = 0; // Reiniciar estado del parpadeo para el nuevo patrón
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

        // DIBUJO DEL FONDO
        this.context.fillStyle = '#0a0a20'; // Color de fondo espacial muy oscuro
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (assets.backgroundImage && assets.backgroundImage.complete) {
            this.context.save(); // Guarda el estado actual del canvas (incluyendo globalAlpha=1.0)
            this.context.globalAlpha = this.backgroundFlashOpacity; // Aplica la opacidad del parpadeo
            this.context.drawImage(assets.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
            this.context.restore(); // Restaura el estado anterior del canvas (globalAlpha vuelve a 1.0)
        }

        this.drawPlayer();
        this.drawEntities();
        this.drawHUD();
        
        this.animationFrameId = requestAnimationFrame(this.drawLoop.bind(this));
    },

    // Dibuja las entidades (balas/enemigos) (MODIFICADO para usar el Map)
    drawEntities() {
        // CRÍTICO: Iterar sobre los UserData en el Map.
        for (const [body, userData] of gameEntities.entries()) {
            
            // Omitir al jugador, ya que se dibuja por separado
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
                fallbackColor = 'yellow'; // Color de fallback para balas
            } else if (userData.type === 'enemy') {
                // Selecciona la imagen correcta según el enemyTypeIndex
                const enemyType = game.enemyTypes[userData.enemyTypeIndex]; // Accede al array de tipos
                image = enemyType ? enemyType.image() : assets.enemyImage; // Usa la imagen del tipo o el default
                fallbackColor = enemyType ? enemyType.color : 'red'; // Color de fallback del tipo
            } else {
                continue; // Si no es ni bala ni enemigo, no dibujar
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

    // Dibuja el jugador
    drawPlayer() {
        if (!this.player.body) return;

        const pos = this.player.body.GetPosition();

        const x = physics.metersToPixels(pos.x);
        const y = physics.metersToPixels(pos.y);
        const r = this.player.radius; // Radio del cuerpo físico (hitbox)

        if (assets.playerImage && assets.playerImage.complete) {
            const imageScaleFactor = 1.5; // Ajusta este valor para hacerla más grande o pequeña

            const scaledWidth = (r * 2) * imageScaleFactor;
            const scaledHeight = (r * 2) * imageScaleFactor;

            // Para centrar la imagen agrandada, ajustamos x e y.
            const offsetX = (scaledWidth - (r * 2)) / 2;
            const offsetY = (scaledHeight - (r * 2)) / 2;

            this.context.drawImage(
                assets.playerImage,
                x - r - offsetX, // Posición X ajustada para centrar la imagen agrandada
                y - r - offsetY, // Posición Y ajustada para centrar la imagen agrandada
                scaledWidth,     // Ancho de la imagen escalado
                scaledHeight     // Alto de la imagen escalado
            );
        }
        // No hay 'else' aquí para evitar dibujar un círculo azul si la imagen no carga.
    },

    // Actualiza el HUD
    drawHUD() {
        document.getElementById('score').innerText = `SCORE: ${this.player.score}`;
        document.getElementById('life').innerText = `LIFE: ${this.player.userData.life}`;
    },

    // Lógica de estado y fin del juego
    updateGameLogic() {
        if (this.player.userData.life <= 0) {
            this.setState('gameover');
            document.getElementById('final-score').innerText = `Puntuación Final: ${this.player.score}`;
        }
    },

    // Lógica de responsividad
    resize() {
        const maxWidth = window.innerWidth;
        const maxHeight = window.innerHeight;

        // Calcular la escala para que el juego se ajuste a la ventana
        const scale = Math.min(maxWidth / 640, maxHeight / 480);

        const gameContainer = document.getElementById("gamecontainer");
        gameContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
        this.scale = scale;
    },

    // Lógica de accesibilidad (control visual del botón de mute/unmute)
    toggleMute() {
        const muteButton = document.getElementById('mute-button');
        if (muteButton.innerText === '🔇') {
             muteButton.innerText = '🔊';
        } else {
             muteButton.innerText = '🔇';
        }
    },
    
    // **********************************************
    // NUEVAS FUNCIONES DE CONTROLES
    // **********************************************
    
    /**
     * Muestra la ventana de controles (popup).
     */
    showControls: function() {
        if (this.state === 'menu') {
            document.getElementById("controls-popup").style.display = 'flex';
        }
    },

    /**
     * Oculta la ventana de controles (popup).
     */
    hideControls: function() {
        document.getElementById("controls-popup").style.display = 'none';
    }
};