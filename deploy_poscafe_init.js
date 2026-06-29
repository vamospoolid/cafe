const { Client } = require('ssh2');

const config = {
    host: '173.212.243.240',
    port: 22,
    username: 'root',
    password: 'Ahmad_dcc07'
};

async function createAndCheckFolder() {
    const conn = new Client();
    
    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            console.log('✅ SSH Connected to VPS!');
            
            // 1. Buat folder poscafe di dalam /var/www/
            const folderPath = '/var/www/poscafe';
            const cmdCreate = `mkdir -p ${folderPath}`;
            
            console.log(`🚀 Creating folder: ${folderPath}`);
            conn.exec(cmdCreate, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                stream.on('data', () => {});
                stream.stderr.on('data', () => {});
                
                stream.on('close', (code) => {
                    console.log(`✅ Command mkdir executed (Exit code: ${code})`);
                    
                    // 2. Cek apakah folder berhasil dibuat
                    const cmdCheck = `ls -ld /var/www/poscafe`;
                    console.log(`🔍 Checking if folder exists...`);
                    
                    conn.exec(cmdCheck, (err, checkStream) => {
                        if (err) {
                            conn.end();
                            return reject(err);
                        }
                        
                        let output = '';
                        checkStream.on('data', (data) => {
                            output += data.toString();
                        });
                        
                        checkStream.on('close', () => {
                            if (output.trim()) {
                                console.log('🎉 Folder poscafe BERHASIL dibuat!');
                                console.log(output.trim());
                            } else {
                                console.log('❌ Folder poscafe TIDAK DITEMUKAN!');
                            }
                            
                            conn.end();
                            resolve();
                        });
                    });
                });
            });
        }).on('error', (err) => {
            reject(err);
        }).connect(config);
    });
}

// Fungsi untuk upload file ke VPS (contoh)
async function uploadFileToVPS(localPath, remotePath) {
    const conn = new Client();
    
    return new Promise((resolve, reject) => {
        conn.on('ready', () => {
            conn.sftp((err, sftp) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                
                console.log(`📤 Uploading ${localPath} to ${remotePath}...`);
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) {
                        conn.end();
                        return reject(err);
                    }
                    console.log('✅ Upload successful!');
                    conn.end();
                    resolve();
                });
            });
        }).on('error', (err) => {
            reject(err);
        }).connect(config);
    });
}

// Menjalankan pengecekan
createAndCheckFolder()
    .then(() => {
        console.log('\n🌟 Proses selesai.');
    })
    .catch((err) => {
        console.error('❌ Error:', err);
    });
