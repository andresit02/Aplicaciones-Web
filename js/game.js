// game.js (CÓDIGO CORREGIDO PARA MUTE DEL MENÚ Y VISIBILIDAD DE PAUSA)

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
        
        // ⭐️ Ajustar el icono de mute del menú al estado inicial
        const menuMuteButton = document.getElementById('menu-mute-button');
        if (menuMuteButton) {
            menuMuteButton.innerText = loader.isMuted ? '🔇' : '🔊';
        }
        // El botón del juego se ajusta en setState('playing')
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
        
        input.fire = false; 
        
        document.getElementById('gamestartscreen').style.display = (newState === 'menu') ? 'flex' : 'none';
        document.getElementById('loadingscreen').style.display = (newState === 'loading') ? 'block' : 'none';
        
        document.getElementById('gameinterfacescreen').style.display = (newState === 'playing' || newState === 'paused' || newState === 'gameover') ? 'block' : 'none';
        
        document.getElementById('gameoverscreen').style.display = (newState === 'gameover') ? 'flex' : 'none';
        
        document.getElementById('pausescreen').style.display = (newState === 'paused') ? 'flex' : 'none';

        document.getElementById('controls-popup').style.display = 'none'; 

        // NUEVA LÓGICA DE AUDIO
        if (this.currentMusicNode) {
            this.currentMusicNode.stop();
            this.currentMusicNode = null;
        }
        
        // ⭐️ CONTROL DE BOTONES DE MUTE
        const menuMuteButton = document.getElementById('menu-mute-button');
        const gameMuteButton = document.getElementById('game-mute-button');

        if (newState === 'menu') {
            if (menuMuteButton) menuMuteButton.style.display = 'block';
            if (gameMuteButton) gameMuteButton.style.display = 'none';
            
            document.getElementById('pause-button').innerText = '||'; 
            this.resumeAudioContext(); 
            
            // Si está muteado, el masterGainNode debe estar en 0 (establecido en toggleMute)
            // Si no está muteado, reproducimos la música.
            if (assets.menuMusic && !loader.isMuted) { 
                this.currentMusicNode = playSound(assets.menuMusic, true, 0.4); 
            }
            this.stopLoop();
            
        } else if (newState === 'playing') {
            if (menuMuteButton) menuMuteButton.style.display = 'none';
            if (gameMuteButton) {
                gameMuteButton.style.display = 'block';
                // ⭐️ Transferir el estado de mute al botón de juego
                gameMuteButton.innerText = loader.isMuted ? '🔇' : '🔊';
            }
            
            document.getElementById('pause-button').innerText = '||'; 
            this.startLoop();
            
            // Asegurar que el audio esté activado si estaba muteado solo para el menú
            if (loader.isMuted) {
                loader.masterGainNode.gain.value = 0; // Mantenemos el mute si se inicia muteado
            } else {
                loader.masterGainNode.gain.value = 1.0; 
            }
            
        } else if (newState === 'paused') {
            if (menuMuteButton) menuMuteButton.style.display = 'none';
            if (gameMuteButton) gameMuteButton.style.display = 'block';
            
            document.getElementById('pause-button').innerText = '▶'; 
            this.stopLoop(); 
            
        } else if (newState === 'gameover') {
            if (menuMuteButton) menuMuteButton.style.display = 'none';
            if (gameMuteButton) gameMuteButton.style.display = 'none';
            
            playSound(assets.gameOverSound, false, 0.8); 
            this.stopLoop();
            
        } else {
            if (menuMuteButton) menuMuteButton.style.display = 'none';
            if (gameMuteButton) gameMuteButton.style.display = 'none';
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
            loader.audioContext.resume().then(() => {
                console.log("AudioContext reanudado exitosamente.");
            }).catch(error => {
                console.error("Error al intentar reanudar el AudioContext:", error);
            });
        }
    },

    // Inicia la carga de recursos (CORREGIDA PARA EVITAR BLOQUEOS)
    startLoading() {
        loader.onload = this.startGame.bind(this);
        this.resumeAudioContext(); 
        this.setState('loading');
        
        loader.loadAudio("assets/audio/menu_music.mp3").then(buffer => assets.menuMusic = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/shoot.mp3").then(buffer => assets.shootSound = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/hit.mp3").then(buffer => assets.hitSound = buffer).catch(e => console.error(e));
        loader.loadAudio("assets/audio/gameover.mp3").then(buffer => assets.gameOverSound = buffer).catch(e => console.error(e));

        assets.playerImage = loader.loadImage("assets/images/player.png");
        assets.enemyImage = loader.loadImage("assets/images/enemy.png"); 
        assets.enemyImage2 = loader.loadImage("assets/images/enemy2.png"); 
        assets.enemyImage3 = loader.loadImage("assets/images/enemy3.png"); 
        assets.bulletImage = loader.loadImage("assets/images/bullet.png");
        assets.backgroundImage = loader.loadImage("assets/images/background.png"); 
    },

    // Empieza el juego (callback del loader)
    startGame() {
        this.player.life = 100;
        this.player.score = 0;
        this.player.userData.life = 100;
        this.player.userData.isDestroyed = false;
        
        this.timeElapsed = 0; 
        this.difficultyFactor = 1.0;
        this.lastDifficultyUpdate = Date.now(); 

        this.backgroundFlashState = 0;
        this.backgroundFlashOpacity = 1.0; 
        this.lastBackgroundFlashTime = Date.now();
        this.currentPatternIndex = 0; 
        this.lastPatternChangeTime = Date.now();

        for (const body of gameEntities.keys()) { 
            this.world.DestroyBody(body); 
        }
        gameEntities.clear();
        spawnTimer = 0;

        if (this.player.body) {
            this.world.DestroyBody(this.player.body);
        }

        this.player.body = physics.createCircleBody(
            this.canvas.width / 2,
            this.canvas.height / 2,
            this.player.radius,
            this.player.userData 
        );
        this.player.body.SetLinearDamping(0);
        this.player.body.SetAngularDamping(0);
        this.player.body.SetSleepingAllowed(false); 

        this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(this.canvas.width / 2), physics.pixelsToMeters(this.canvas.height - 50)));

        lastUpdateTime = Date.now();
        
        // ⭐️ Asegurar que el audio esté activado al iniciar el juego, si no estaba muteado antes
        loader.isMuted = false;
        if (loader.masterGainNode) {
            loader.masterGainNode.gain.value = 1.0; 
        }
        
        this.setState('playing');
    },

    // Lógica para volver al menú
    goToMenu() {
        this.setState('menu');
    },

    // **********************************************
    // GAME LOOP Y FÍSICA
    // **********************************************

    // ... (logicLoop y spawnEnemy sin cambios funcionales)
    startLoop() {
        if (this.logicInterval) return; 
        
        this.logicInterval = setInterval(this.logicLoop.bind(this), this.animationTime);
        this.animationFrameId = requestAnimationFrame(this.drawLoop.bind(this));
    },

    stopLoop() {
        clearInterval(this.logicInterval);
        this.logicInterval = null;
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
    },
    
    logicLoop() {
        if (this.state !== 'playing' || !this.player.body) return;

        const now = Date.now();
        let timeStep = (now - lastUpdateTime) / 1000;
        lastUpdateTime = now;
        
        if (timeStep > (1/10)) { 
            timeStep = 1/10;
        }

        this.timeElapsed += timeStep * 1000;
        
        if (this.timeElapsed >= this.difficultyIncreaseTime) {
            this.difficultyFactor += this.difficultyIncreaseRate;
            this.timeElapsed -= this.difficultyIncreaseTime; 
        }

        spawnTimer += game.animationTime;
        const currentSpawnInterval = Math.max(200, spawnInterval / this.difficultyFactor); 

        if (spawnTimer >= currentSpawnInterval) {
            this.spawnEnemy();
            spawnTimer = 0;
        }

        let vx = 0;
        const speedMeters = physics.pixelsToMeters(this.player.speed);

        if (input.left) vx -= speedMeters;
        if (input.right) vx += speedMeters;

        this.player.body.SetLinearVelocity(new b2Vec2(vx, 0));

        const playerPos = this.player.body.GetPosition();
        const playerXPixels = physics.metersToPixels(playerPos.x);
        const minX = this.player.radius;
        const maxX = this.canvas.width - this.player.radius;

        if (playerXPixels < minX) {
            this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(minX), playerPos.y));
            this.player.body.SetLinearVelocity(new b2Vec2(0, 0));
        } else if (playerXPixels > maxX) {
            this.player.body.SetPosition(new b2Vec2(physics.pixelsToMeters(maxX), playerPos.y));
            this.player.body.SetLinearVelocity(new b2Vec2(0, 0));
        }

        if (input.fire && now > this.player.lastShotTime) {
            this.fireBullet();
            this.player.lastShotTime = now + (1000 / this.player.fireRate);
        }

        physics.step(timeStep);

        this.cleanUpEntities();
        this.updateGameLogic();
    },
    
    spawnEnemy() {
        const canvasWidth = this.canvas.width;
        
        const enemyType = this.enemyTypes[Math.floor(Math.random() * this.enemyTypes.length)];

        const enemyRadius = enemyType.radius;

        const spawnX = Math.random() * (canvasWidth - 2 * enemyRadius) + enemyRadius;
        const spawnY = 10;

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
            enemyTypeIndex: this.enemyTypes.indexOf(enemyType) 
        };

        const enemyBody = physics.createCircleBody(spawnX, spawnY, enemyRadius, userData);
        enemyBody.SetFixedRotation(true);
        enemyBody.SetLinearVelocity(new b2Vec2(0, enemySpeedMeters));

        gameEntities.set(enemyBody, userData);
    },

    fireBullet() {
        if (!this.player.body) return;
        
        playSound(assets.shootSound, false, 0.5);

        const playerPos = this.player.body.GetPosition();

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

        bulletBody.SetLinearVelocity(new b2Vec2(0, -bulletSpeedMeters));

        gameEntities.set(bulletBody, userData);
    },
    
    handleContact(bodyA, bodyB) {
        let bullet, enemy, player;

        if (bodyA.isDestroyed || bodyB.isDestroyed) {
            return;
        }

        if (bodyA.type === 'bullet' && bodyB.type === 'enemy') {
            bullet = bodyA; enemy = bodyB;
        } else if (bodyB.type === 'bullet' && bodyA.type === 'enemy') {
            bullet = bodyB; enemy = bodyA;
        } else if (bodyA.type === 'enemy' && bodyB.type === 'player') {
            enemy = bodyA; player = bodyB;
        } else if (bodyB.type === 'enemy' && bodyA.type === 'player') {
            enemy = bodyB; player = bodyA;
        }

        if (bullet && enemy) {
            bullet.isDestroyed = true; 
            enemy.isDestroyed = true; 
            this.player.score += enemy.points;
            playSound(assets.hitSound, false, 0.7); 
        }

        if (enemy && player) {
            player.life -= enemy.damage; 
            enemy.isDestroyed = true; 
            playSound(assets.hitSound, false, 1.0);
        }
    },

    cleanUpEntities() {
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const bodiesToDestroy = [];

        for (const [body, userData] of gameEntities.entries()) {
            
            if (userData.type === 'player') {
                continue;
            }

            const pos = body.GetPosition();
            const x = physics.metersToPixels(pos.x);
            const y = physics.metersToPixels(pos.y);
            const r = userData.radius;
            
            const isBullet = userData.type === 'bullet';
            const topLimit = isBullet ? -50 : -r; 
            
            const fueraDeLimites = (x < -r || x > canvasWidth + r || y < topLimit || y > canvasHeight + r);
            
            const vidaTerminada = userData.isDestroyed || (userData.life !== undefined && userData.life <= 0);

            if (fueraDeLimites || vidaTerminada) {
                bodiesToDestroy.push(body);
            }
        }

        for (const body of bodiesToDestroy) {
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

        this.context.fillStyle = '#0a0a20'; 
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (assets.backgroundImage && assets.backgroundImage.complete) {
            this.context.save(); 
            this.context.globalAlpha = this.backgroundFlashOpacity; 
            this.context.drawImage(assets.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
            this.context.restore(); 
        }

        this.drawPlayer();
        this.drawEntities();
        this.drawHUD();
        
        this.animationFrameId = requestAnimationFrame(this.drawLoop.bind(this));
    },

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
                const enemyType = game.enemyTypes[userData.enemyTypeIndex]; 
                image = enemyType ? enemyType.image() : assets.enemyImage; 
                fallbackColor = enemyType ? enemyType.color : 'red'; 
            } else {
                continue; 
            }

            if (image && image.complete) {
                this.context.drawImage(image, x - r, y - r, r * 2, r * 2);
            } else {
                this.context.fillStyle = fallbackColor;
                this.context.beginPath();
                this.context.arc(x, y, r, 0, Math.PI * 2, true);
                this.context.fill();
            }
        }
    },

    drawPlayer() {
        if (!this.player.body) return;

        const pos = this.player.body.GetPosition();

        const x = physics.metersToPixels(pos.x);
        const y = physics.metersToPixels(pos.y);
        const r = this.player.radius; 

        if (assets.playerImage && assets.playerImage.complete) {
            const imageScaleFactor = 1.5; 

            const scaledWidth = (r * 2) * imageScaleFactor;
            const scaledHeight = (r * 2) * imageScaleFactor;

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

    drawHUD() {
        document.getElementById('score').innerText = `SCORE: ${this.player.score}`;
        document.getElementById('life').innerText = `LIFE: ${this.player.userData.life}`;
    },

    updateGameLogic() {
        if (this.player.userData.life <= 0) {
            this.setState('gameover');
            document.getElementById('final-score').innerText = `Puntuación Final: ${this.player.score}`;
        }
    },

    resize() {
        const maxWidth = window.innerWidth;
        const maxHeight = window.innerHeight;

        const scale = Math.min(maxWidth / 640, maxHeight / 480);

        const gameContainer = document.getElementById("gamecontainer");
        gameContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
        this.scale = scale;
    },

    /**
     * Alterna el estado de mute global y actualiza el icono del botón correcto.
     * @param {string} location 'menu' o 'game' para saber qué botón actualizar.
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
        
        // 2. Controlar la ganancia maestra
        if (loader.masterGainNode) {
            loader.masterGainNode.gain.value = loader.isMuted ? 0 : 1.0; 
        }
        
        // 3. Controlar la música del menú
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
    // NUEVAS FUNCIONES DE CONTROLES
    // **********************************************
    
    showControls: function() {
        if (this.state === 'menu') {
            document.getElementById("controls-popup").style.display = 'flex';
        }
    },

    hideControls: function() {
        document.getElementById("controls-popup").style.display = 'none';
    }
};