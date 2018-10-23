const http = require('http');
const path = require('path');
const fs = require('fs');

/**
 * Methodes utilitaires pour le système de fichier
 */
class FileSystemUtils {
    /**
     * S'assure que le répertoire d'un fichier donné existe et le crée le cas échéant
     * @param filePath
     * @return {boolean}
     */
    static ensureDirectoryExistence(filePath) {
        let dirname = path.dirname(filePath);
        if (fs.existsSync(dirname)) {
            return true;
        }
        FileSystemUtils.ensureDirectoryExistence(dirname);
        fs.mkdirSync(dirname);
    }

    /**
     * Télécharge un fichier en local
     * @param {string} url Url où télécharger le fichier
     * @param {string} dest url local où télécharger le fichier
     * @param {function} cb Une fois que c'est fini
     */
    static download(url, dest, cb) {
        let file = fs.createWriteStream(dest);
        let request = http.get(url, function(response) {
            response.pipe(file);
            file.on('finish', function() {
                file.close(cb);  // close() is async, call cb after close completes.
            });
        });
    }
}
module.exports = FileSystemUtils;