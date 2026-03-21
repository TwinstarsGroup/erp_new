// Complete attachment management functionality

const fs = require('fs');
const path = require('path');

class AttachmentManager {
    constructor(attachmentDir) {
        this.attachmentDir = attachmentDir;
        this.initialize();
    }

    initialize() {
        if (!fs.existsSync(this.attachmentDir)) {
            fs.mkdirSync(this.attachmentDir);
        }
    }

    upload(file) {
        const filePath = path.join(this.attachmentDir, file.name);
        fs.writeFileSync(filePath, file.data);
        return { message: 'File uploaded successfully', filePath };
    }

    search(filename) {
        const filePath = path.join(this.attachmentDir, filename);
        return fs.existsSync(filePath) ? { exists: true, filePath } : { exists: false };
    }

    delete(filename) {
        const filePath = path.join(this.attachmentDir, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { message: 'File deleted successfully' };
        }
        return { message: 'File not found' };
    }

    display() {
        return fs.readdirSync(this.attachmentDir);
    }
}

// Example usage
const attachmentManager = new AttachmentManager('./uploads');

module.exports = attachmentManager;
