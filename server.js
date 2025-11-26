#!/usr/bin/env node

// ===== Load Configuration =====
const fs = require('fs');
const path = require('path');

let config;
try {
    config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
} catch (err) {
    console.error('❌ Error loading config.json:', err.message);
    process.exit(1);
}

// Validate configuration
if (config.apiKey === "<<FillAPIKey>>") {
    console.error("❌ Please change API key in config.json!");
    process.exit(1);
}

if (!config.doors || config.doors.length === 0) {
    console.error("❌ No doors configured in config.json!");
    process.exit(1);
}

// ===== Dependencies =====
const express = require('express');
const https = require('https');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// GPIO handling - try onoff first, fallback to direct gpiochip
let Gpio = null;
let useDirectGpio = false;

try {
    Gpio = require('onoff').Gpio;
} catch (err) {
    console.log('⚠️  onoff not available, will use direct GPIO access');
    useDirectGpio = true;
}

// ===== Direct GPIO Implementation (for gpiochip) =====
class DirectGpio {
    constructor(gpio, direction) {
        this.gpio = gpio;
        this.direction = direction;
        this.basePath = `/sys/class/gpio/gpio${gpio}`;
        
        // Export GPIO if not already exported
        try {
            if (!fs.existsSync(this.basePath)) {
                fs.writeFileSync('/sys/class/gpio/export', String(gpio));
                // Wait for filesystem
                let retries = 0;
                while (!fs.existsSync(this.basePath) && retries < 10) {
                    require('child_process').execSync('sleep 0.1');
                    retries++;
                }
            }
            
            // Set direction
            fs.writeFileSync(`${this.basePath}/direction`, direction === 'high' ? 'high' : 'out');
            
            // Set initial value if out
            if (direction === 'out' || direction === 'high') {
                this.writeSync(1);
            }
        } catch (err) {
            throw new Error(`Failed to setup GPIO ${gpio}: ${err.message}`);
        }
    }
    
    writeSync(value) {
        try {
            fs.writeFileSync(`${this.basePath}/value`, value ? '1' : '0');
        } catch (err) {
            throw new Error(`Failed to write GPIO ${this.gpio}: ${err.message}`);
        }
    }
    
    readSync() {
        try {
            const val = fs.readFileSync(`${this.basePath}/value`, 'utf8');
            return parseInt(val.trim());
        } catch (err) {
            throw new Error(`Failed to read GPIO ${this.gpio}: ${err.message}`);
        }
    }
    
    unexport() {
        try {
            if (fs.existsSync(this.basePath)) {
                fs.writeFileSync('/sys/class/gpio/unexport', String(this.gpio));
            }
        } catch (err) {
            // Ignore unexport errors
        }
    }
}

// ===== Initialize GPIO Pins =====
const doorPins = new Map();

// Check GPIO system availability
const checkGpioSystem = () => {
    try {
        if (fs.existsSync('/dev/gpiochip0')) {
            return 'gpiochip';
        }
        if (fs.existsSync('/sys/class/gpio/export')) {
            return 'sysfs';
        }
        return 'none';
    } catch (e) {
        return 'none';
    }
};

const gpioSystem = checkGpioSystem();
console.log(`🔌 GPIO System: ${gpioSystem}`);

if (gpioSystem === 'none') {
    console.warn('⚠️  No GPIO system detected - running in simulation mode');
}

try {
    config.doors.forEach(door => {
        if (gpioSystem !== 'none') {
            try {
                console.log(`   Initializing GPIO ${door.gpio} for ${door.name}...`);
                
                let pin;
                
                // Try DirectGpio first (works better with gpiochip)
                if (gpioSystem === 'gpiochip') {
                    try {
                        pin = new DirectGpio(door.gpio, 'high');
                        console.log(`   ✓ Using direct GPIO access (gpiochip)`);
                    } catch (directErr) {
                        console.log(`   Direct GPIO failed: ${directErr.message}`);
                        
                        // Fallback to onoff if available
                        if (Gpio) {
                            pin = new Gpio(door.gpio, 'high');
                            console.log(`   ✓ Using onoff library`);
                        } else {
                            throw directErr;
                        }
                    }
                } else {
                    // For sysfs, prefer onoff
                    if (Gpio) {
                        pin = new Gpio(door.gpio, 'high');
                        console.log(`   ✓ Using onoff library`);
                    } else {
                        pin = new DirectGpio(door.gpio, 'high');
                        console.log(`   ✓ Using direct GPIO access`);
                    }
                }
                
                // Verify pin works
                pin.writeSync(1);
                
                doorPins.set(door.id, { pin, config: door, isSimulated: false });
                console.log(`✓ Initialized ${door.name} on GPIO ${door.gpio} (Pin ${door.physicalPin})`);
                
            } catch (pinErr) {
                console.error(`\n❌ Failed to initialize GPIO ${door.gpio} for ${door.name}`);
                console.error(`   Error: ${pinErr.message}`);
                console.error(`\n   Troubleshooting:`);
                console.error(`   - Check pin availability: gpioinfo | grep "line.*${door.gpio}"`);
                console.error(`   - Verify permissions: ls -la /sys/class/gpio/`);
                console.error(`   - Try different GPIO pin in config.json`);
                
                throw pinErr;
            }
        } else {
            // Simulated pin for development/testing
            doorPins.set(door.id, { 
                pin: { 
                    writeSync: (val) => console.log(`[SIM] GPIO ${door.gpio} = ${val}`),
                    readSync: () => 1,
                    unexport: () => {}
                }, 
                config: door,
                isSimulated: true
            });
            console.log(`✓ Simulated ${door.name} on GPIO ${door.gpio} (Pin ${door.physicalPin})`);
        }
    });
} catch (err) {
    console.error('\n❌ GPIO initialization failed:', err.message);
    console.error('\n📋 System Information:');
    console.error(`   GPIO System: ${gpioSystem}`);
    console.error(`   Running as: ${process.getuid ? process.getuid() : 'unknown'} (0=root)`);
    console.error('\n🔧 Troubleshooting:');
    
    if (gpioSystem === 'sysfs') {
        console.error('   Legacy sysfs detected. Try:');
        console.error('   1. Free pins: echo 26 > /sys/class/gpio/unexport && echo 20 > /sys/class/gpio/unexport');
        console.error('   2. Check permissions: ls -la /sys/class/gpio/');
        console.error('   3. Add to group: sudo usermod -a -G gpio $USER');
    } else if (gpioSystem === 'gpiochip') {
        console.error('   Modern gpiochip detected. You may need libgpiod:');
        console.error('   1. Install: sudo apt-get install -y gpiod libgpiod-dev');
        console.error('   2. Or use: sudo npm install onoff --unsafe-perm');
        console.error('   3. Check: gpioinfo | grep -E "26|20"');
    } else {
        console.error('   No GPIO system found!');
        console.error('   1. Are you on a Raspberry Pi?');
        console.error('   2. Check kernel: uname -a');
        console.error('   3. Install GPIO support: sudo apt-get install raspi-gpio');
    }
    
    console.error('\n💡 Quick fixes:');
    console.error('   - Reboot: sudo reboot');
    console.error('   - Reinstall onoff: npm install --force onoff');
    console.error('   - Use different pins in config.json');
    
    process.exit(1);
}

// ===== Express Setup =====
const app = express();
const JWT_SECRET = config.apiKey + '_jwt_secret';

// ===== Middleware =====
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helmet for security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: config.rateLimiting.windowMs,
    max: config.rateLimiting.maxRequests,
    message: { success: false, error: 'Too many requests' },
    standardHeaders: true,
    legacyHeaders: false,
});

const actionLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: config.rateLimiting.maxActionsPerMinute,
    message: { success: false, error: 'Too many actions, please wait' }
});

app.use(limiter);

// ===== Helper Functions =====
function secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function generateToken(doorId = null) {
    const payload = { 
        purpose: 'garage_access',
        timestamp: Date.now()
    };
    if (doorId) payload.doorId = doorId;
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

async function triggerDoor(doorId) {
    const door = doorPins.get(doorId);
    if (!door) {
        throw new Error('Door not found');
    }

    const { pin, config: doorConfig } = door;
    
    return new Promise((resolve) => {
        pin.writeSync(0); // Activate
        setTimeout(() => {
            pin.writeSync(1); // Deactivate
            resolve({
                success: true,
                door: doorConfig.name,
                doorId: doorId
            });
        }, doorConfig.activationTime);
    });
}

// ===== Routes =====

// Main entry - serve static HTML
app.get('/:key', (req, res) => {
    if (!secureCompare(req.params.key, config.apiKey)) {
        return res.status(403).send('Access denied');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get available doors and token
app.get('/api/:key/config', (req, res) => {
    if (!secureCompare(req.params.key, config.apiKey)) {
        return res.status(403).json({ success: false, error: 'Invalid API key' });
    }

    const token = generateToken();
    const doors = config.doors.map(d => ({
        id: d.id,
        name: d.name,
        physicalPin: d.physicalPin
    }));

    res.json({
        success: true,
        token,
        doors
    });
});

// Trigger specific door with JWT
app.post('/api/action/:doorId', actionLimiter, async (req, res) => {
    const token = req.body?.token || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token || !verifyToken(token)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    try {
        const result = await triggerDoor(req.params.doorId);
        res.json(result);
    } catch (error) {
        res.status(404).json({ success: false, error: error.message });
    }
});

// Legacy endpoint - backward compatibility for old shortcuts
app.get('/action/:key', actionLimiter, async (req, res) => {
    if (!secureCompare(req.params.key, config.apiKey)) {
        return res.status(403).json({ success: false, error: 'Invalid API key' });
    }

    // Trigger first door for legacy compatibility
    try {
        const firstDoorId = config.doors[0].id;
        const result = await triggerDoor(firstDoorId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Health check
app.get('/health', (req, res) => {
    const doorStatus = Array.from(doorPins.entries()).map(([id, door]) => ({
        id,
        name: door.config.name,
        gpio: door.config.gpio,
        ready: door.pin.readSync() === 1
    }));

    res.json({ 
        status: 'ok',
        version: '3.0.0',
        doors: doorStatus
    });
});

// ===== Server Start =====
const server = https.createServer({
    key: fs.readFileSync(config.ssl.keyPath),
    cert: fs.readFileSync(config.ssl.certPath),
}, app);

server.listen(config.port, () => {
    console.log('\n🚗 Garage Opener Server v3.0.0');
    console.log(`🔒 Listening on port ${config.port}`);
    console.log(`📱 Access URL: https://your-domain:${config.port}/${config.apiKey}`);
    console.log(`\n✓ ${config.doors.length} door(s) configured:`);
    config.doors.forEach(door => {
        console.log(`  - ${door.name} (GPIO ${door.gpio} / Pin ${door.physicalPin})`);
    });
    console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    // Cleanup all GPIO pins
    doorPins.forEach((door, id) => {
        try {
            door.pin.unexport();
            console.log(`✓ Cleaned up ${door.config.name}`);
        } catch (err) {
            console.error(`✗ Error cleaning up ${door.config.name}:`, err.message);
        }
    });
    
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    process.exit(1);
});
