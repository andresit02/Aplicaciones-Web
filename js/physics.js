// Definiciones de conveniencia para Box2D (Aliases)
const b2Vec2 = Box2D.Common.Math.b2Vec2;
const b2BodyDef = Box2D.Dynamics.b2BodyDef;
const b2Body = Box2D.Dynamics.b2Body;
const b2FixtureDef = Box2D.Dynamics.b2FixtureDef;
const b2World = Box2D.Dynamics.b2World;
const b2CircleShape = Box2D.Collision.Shapes.b2CircleShape;
const b2ContactListener = Box2D.Dynamics.b2ContactListener;

/**
 * Módulo de gestión del motor de física Box2D.
 * Se utiliza una escala de 30 píxeles por metro, estándar para Box2D.
 */
const physics = {
    world: null,
    scale: 30, // 30 píxeles = 1 metro (Estándar para Box2D)
    
    /**
     * Inicializa el mundo de Box2D.
     */
    init: function() {
        // Gravedad: 0 en X y 0 en Y (shooter simple, sin gravedad para el espacio)
        const gravity = new b2Vec2(0, 0); 
        const allowSleep = true; // Permite que los cuerpos inactivos se "duerman" para optimización
        
        this.world = new b2World(gravity, allowSleep);
        this.addContactListener();
    },

    /**
     * Realiza un paso de la simulación física.
     * @param {number} timeStep - El tiempo transcurrido desde el último paso (en segundos).
     */
    step: function(timeStep) {
        // Asegurar que el paso de tiempo no sea demasiado grande para evitar errores de colisión
        if (timeStep > (1/30)) {
            timeStep = 1/30;
        }
        
        const velocityIterations = 8; // Mayor precisión en la velocidad
        const positionIterations = 3; // Mayor precisión en la posición
        
        this.world.Step(timeStep, velocityIterations, positionIterations);
        this.world.ClearForces(); // Limpia las fuerzas aplicadas en el ciclo anterior
    },

    /**
     * Crea un cuerpo circular dinámico o estático para entidades de juego.
     * @param {number} x - Posición X en píxeles.
     * @param {number} y - Posición Y en píxeles.
     * @param {number} radius - Radio en píxeles.
     * @param {object} userData - Datos de juego (type, life, isDestroyed, etc.) adjuntos al cuerpo.
     * @param {boolean} isDynamic - Si el cuerpo es dinámico (se mueve) o estático (paredes).
     * @returns {b2Body} El cuerpo Box2D creado.
     */
    createCircleBody: function(x, y, radius, userData, isDynamic = true) {
        const bodyDef = new b2BodyDef();
        
        // Define el tipo de cuerpo: dinámico (movible) o estático (inmovible)
        bodyDef.type = isDynamic ? b2Body.b2_dynamicBody : b2Body.b2_staticBody;
        // Convierte las coordenadas de píxeles a metros
        bodyDef.position.Set(x / this.scale, y / this.scale);
        
        const body = this.world.CreateBody(bodyDef);
        
        const fixtureDef = new b2FixtureDef();
        fixtureDef.density = 1.0;
        fixtureDef.friction = 0.0; // Sin fricción para movimiento espacial
        fixtureDef.restitution = 0.2; // Baja restitución (no queremos rebotes grandes)
        // Define la forma circular y convierte el radio a metros
        fixtureDef.shape = new b2CircleShape(radius / this.scale);

        // Adjunta datos de juego (vida, tipo, isDestroyed) al cuerpo físico
        // CRÍTICO: El body.GetUserData() retornará este objeto para la lógica de colisiones en el ContactListener.
        body.SetUserData(userData); 
        body.CreateFixture(fixtureDef);
        
        return body;
    },

    /**
     * Configura el oyente de contacto (ContactListener) para manejar colisiones.
     */
    addContactListener: function() {
        const listener = new b2ContactListener();
        
        // Se llama cuando dos cuerpos empiezan a tocarse
        listener.BeginContact = function(contact) {
            // Obtiene los datos de juego adjuntos a los cuerpos (UserData)
            const bodyA = contact.GetFixtureA().GetBody().GetUserData();
            const bodyB = contact.GetFixtureB().GetBody().GetUserData();
            
            // Llama a la lógica de juego solo si el juego está activo y ambos cuerpos tienen UserData
            // Se asume que game.handleContact maneja la lógica de destrucción (marcando isDestroyed=true)
            // La destrucción real ocurre después del paso de física en game.cleanUpEntities
            if (game.state === 'playing' && bodyA && bodyB) {
                game.handleContact(bodyA, bodyB);
            }
        };
        
        // PostSolve se puede usar para aplicar impulsos basados en la fuerza de la colisión
        listener.PostSolve = function(contact, impulse) {
            // Actualmente no se usa
        };
        
        this.world.SetContactListener(listener);
    },

    // Conversión de unidades (m/p)
    metersToPixels: function(m) {
        return m * this.scale;
    },
    pixelsToMeters: function(p) {
        return p / this.scale;
    }
};