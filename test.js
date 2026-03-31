const fs = require('fs'); try { const posts = require('./js/posts.js'); console.log('Posts length:', posts.length); } catch (e) { console.error(e.message); }
