/**
 * F.AGRIELLA - LOGIC
 * 
 * Sistem ini sekarang menggunakan Google Sheets sebagai database backend.
 * Data diambil dalam format CSV melalui URL publik Google Sheets.
 */

// (Konfigurasi Google Sheets, Web App URL, dan ntfy.sh dipindahkan ke config.js)

// --- LISTENER REFRESH DARI IFRAME GAS.html ---
// GAS.html mengirim { type: 'refresh' } setelah upload/hapus berhasil.
// Sinkronisasi dan refresh data dilakukan diam-diam di belakang layar.
window.addEventListener('message', async function (event) {
    if (!event.data || event.data.type !== 'refresh') return;

    try {
        // 1. Panggil endpoint autosinkronmateri untuk update sheet dari Drive + GitHub
        if (SYNC_SCRIPT_URL && !SYNC_SCRIPT_URL.includes('PASTE')) {
            const syncUrl = `${SYNC_SCRIPT_URL}${SYNC_SCRIPT_URL.includes('?') ? '&' : '?'}action=sync`;
            await fetch(syncUrl, { mode: 'no-cors' }).catch(() => { });
        }
        // 2. Tunggu sebentar agar Google Sheets sempat update
        await new Promise(resolve => setTimeout(resolve, 3000));
        // 3. Ambil ulang data dan render ulang UI tanpa reload
        await refreshData();
    } catch (e) {
        await refreshData();
    }
});

// --- OVERRIDE CTRL+R / CMD+R UNTUK SINKRONISASI LATAR BELAKANG ---
document.addEventListener('keydown', async function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault(); // Mencegah browser melakukan hard reload

        console.log("Ctrl+R ditekan! Memulai sinkronisasi latar belakang (Autosinkronmateri -> Refresh Data)...");

        // Efek visual: Tampilkan spinner di sebelah logo header
        const syncSpinner = document.getElementById('sync-spinner');
        if (syncSpinner) syncSpinner.style.display = 'inline-block';

        try {
            // 1. Eksekusi script sinkronisasi (GitHub -> Drive -> Sheets)
            if (SYNC_SCRIPT_URL && !SYNC_SCRIPT_URL.includes('PASTE')) {
                const syncUrl = `${SYNC_SCRIPT_URL}${SYNC_SCRIPT_URL.includes('?') ? '&' : '?'}action=sync`;
                await fetch(syncUrl, { mode: 'no-cors' }).catch(() => { });
            }
            // 2. Tunggu 3 detik agar eksekusi script di server kelar
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 3. Ambil ulang data JSON dari Sheets
            await refreshData();
        } catch (err) {
            console.error(err);
            await refreshData();
        } finally {
            if (syncSpinner) syncSpinner.style.display = 'none';
        }
    }
});

// State Data
let coursesData = [];
let materialsData = [];
let assignmentsData = [];
let arsipFotoData = [];
let mahasiswaData = [];
let activeCourse = null; // Menyimpan data course yang sedang dibuka

// Load bookmarks & migrasi data lama jika perlu (dari string ke object)
let bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
if (bookmarks.length > 0 && typeof bookmarks[0] === 'string') {
    bookmarks = []; // Reset jika format lama (string nama MK) terdeteksi
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

// --- LOGIC UTAMA ---

document.addEventListener('DOMContentLoaded', () => {
    initCookieConsent();
    initTheme();
    setupEventListeners();
    initData(); // Mulai fetch data

    // Auto-prompt jika belum pernah ditanya (Mirip OneSignal)
    setTimeout(() => {
        if (Notification.permission === 'default' && localStorage.getItem('cookieConsent') === 'true') {
            // Tampilkan kembali banner atau prompt khusus jika user sudah accept cookie tapi belum pilih notif
            const banner = document.getElementById('cookie-consent-banner');
            if (banner && !banner.classList.contains('show')) {
                const text = banner.querySelector('p');
                if (text) text.innerHTML = "<strong>Ingin menerima notifikasi tugas baru?</strong><br>Aktifkan notifikasi browser untuk mendapatkan pengingat otomatis.";
                banner.classList.add('show');
            }
        }
    }, 3000);
});

function initCookieConsent() {
    const banner = document.getElementById('cookie-consent-banner');
    const acceptAllBtn = document.getElementById('accept-cookie-btn');
    const rejectBtn = document.getElementById('reject-cookie-btn');
    const manageBtn = document.getElementById('manage-cookies-btn');
    const settingsModal = document.getElementById('cookie-settings-modal');
    const savePrefsBtn = document.getElementById('save-cookie-prefs-btn');
    const personalizationToggle = document.getElementById('consent-personalization-toggle');
    const notificationToggle = document.getElementById('consent-notification-toggle');

    if (!banner) return;

    const showBanner = () => {
        const consent = localStorage.getItem('cookieConsent');
        if (!consent) {
            banner.classList.add('show');
        }
    };

    const hideBanner = () => banner.classList.remove('show');

    const openSettingsModal = () => {
        // Set toggle state based on current preference
        personalizationToggle.checked = localStorage.getItem('consent_personalization') === 'true';

        // Cek status notif dari Browser Native (Universal)
        if (notificationToggle) {
            if (Notification.permission === 'granted') {
                notificationToggle.checked = localStorage.getItem('consent_notifications') === 'true';
            } else {
                notificationToggle.checked = false;
                localStorage.setItem('consent_notifications', 'false');
            }
        }

        settingsModal.classList.add('active');
    };

    const closeSettingsModal = () => settingsModal.classList.remove('active');

    const acceptAll = () => {
        localStorage.setItem('cookieConsent', 'true');
        localStorage.setItem('consent_personalization', 'true');
        localStorage.setItem('consent_notifications', 'true');

        // Minta ijin notifikasi & Tawarkan ntfy.sh
        if ("Notification" in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showLocalNotification("Sistem Diaktifkan", "Terima kasih! Kami menyarankan Anda juga subscribe di ntfy.sh agar notifikasi tetap masuk saat web ditutup.");
                    window.open(NTFY_URL, '_blank');
                }
            });
        }
        logSubscriptionToGAS(true);

        hideBanner();
    };

    const rejectAll = () => {
        localStorage.setItem('cookieConsent', 'rejected');
        localStorage.setItem('consent_personalization', 'false');
        hideBanner();
    };

    const savePreferences = () => {
        localStorage.setItem('cookieConsent', 'true');
        localStorage.setItem('consent_personalization', personalizationToggle.checked);

        const finalizeClose = () => {
            hideBanner();
            closeSettingsModal();

            // Simpan status notifikasi secara Lokal & ke GAS (DIY)
            if (notificationToggle && !notificationToggle.disabled) {
                const isEnabled = notificationToggle.checked;
                localStorage.setItem('consent_notifications', isEnabled);

                if (isEnabled) {
                    // Tawarkan ntfy.sh di tab baru
                    if ("Notification" in window) {
                        Notification.requestPermission().then(permission => {
                            if (permission === 'granted') {
                                showLocalNotification("Siap!", "Membuka halaman aktivasi notifikasi background (ntfy.sh)...");
                                window.open(NTFY_URL, '_blank');
                            }
                        });
                    }
                    logSubscriptionToGAS(true);
                } else {
                    logSubscriptionToGAS(false);
                }
            }

            // Jika pengguna menonaktifkan personalisasi, hapus data yang ada
            if (!personalizationToggle.checked) {
                localStorage.removeItem('theme');
                localStorage.removeItem('bookmarks');
                window.history.replaceState("", document.title, window.location.pathname + window.location.search);
                window.location.reload();
            } else {
                if (window.location.hash === '#pengaturan') {
                    window.history.pushState("", document.title, window.location.pathname + window.location.search);
                }
            }
        };

        finalizeClose();
    };

    // Event Listeners
    acceptAllBtn.addEventListener('click', acceptAll);
    if (rejectBtn) rejectBtn.addEventListener('click', rejectAll);
    manageBtn.addEventListener('click', openSettingsModal);
    savePrefsBtn.addEventListener('click', savePreferences);

    // Test Notification via GAS
    const testNotifBtn = document.getElementById('btn-test-notif');
    if (testNotifBtn) {
        testNotifBtn.addEventListener('click', () => {
            const originalHTML = testNotifBtn.innerHTML;
            testNotifBtn.disabled = true;
            testNotifBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Mengirim...';

            // Metode 1: Gunakan Fetch ke SYNC_SCRIPT_URL (Universal: GitHub & GAS)
            if (SYNC_SCRIPT_URL && SYNC_SCRIPT_URL !== 'MASUKKAN_URL_WEB_APP_DISINI') {
                const testUrl = SYNC_SCRIPT_URL + (SYNC_SCRIPT_URL.includes('?') ? '&' : '?') + 'action=test';

                fetch(testUrl, { mode: 'no-cors' })
                    .then(() => {
                        // Tampilkan notifikasi lokal sebagai bukti browser bisa me-render
                        showLocalNotification("Test Notifikasi", "Permintaan test terkirim ke server!");
                        alert('Permintaan Test Notifikasi terkirim! Periksa notifikasi browser Anda.');
                        testNotifBtn.disabled = false;
                        testNotifBtn.innerHTML = originalHTML;
                    })
                    .catch(err => {
                        console.error("Fetch error:", err);
                        alert('Gagal memicu test lewat Web App. Pastikan SYNC_SCRIPT_URL sudah benar.');
                        testNotifBtn.disabled = false;
                        testNotifBtn.innerHTML = originalHTML;
                    });
                return;
            }

            // Metode 2: Fallback ke google.script.run (Hanya jika di URL script.google.com)
            if (typeof google !== 'undefined' && google.script && google.script.run) {
                google.script.run
                    .withSuccessHandler(() => {
                        alert('Test Notifikasi berhasil dipicu via GAS! Periksa perangkat Anda.');
                        testNotifBtn.disabled = false;
                        testNotifBtn.innerHTML = originalHTML;
                    })
                    .withFailureHandler((err) => {
                        alert('Gagal mengirim test: ' + err);
                        testNotifBtn.disabled = false;
                        testNotifBtn.innerHTML = originalHTML;
                    })
                    .testNotification();
                return;
            }

            alert('Konfigurasi Web App (SYNC_SCRIPT_URL) belum diatur.');
            testNotifBtn.disabled = false;
            testNotifBtn.innerHTML = originalHTML;
        });
    }

    setTimeout(() => {
        showBanner();
    }, 1500);
}


// 1. Theme Handling
function initTheme() {
    const toggleBtn = document.getElementById('theme-toggle');
    const icon = toggleBtn.querySelector('i');

    // Atur ikon awal berdasarkan tema yang sudah diterapkan oleh skrip inline di <head>
    if (document.documentElement.getAttribute('data-theme') === 'dark') {
        icon.classList.replace('ph-moon', 'ph-sun');
    }

    toggleBtn.addEventListener('click', (e) => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        const toggleTheme = () => {
            // Animasi putar pada ikon
            icon.classList.remove('spin-active');
            void icon.offsetWidth; // Force reflow agar animasi bisa diulang
            icon.classList.add('spin-active');

            if (isDark) {
                document.documentElement.removeAttribute('data-theme');
                if (localStorage.getItem('consent_personalization') === 'true') {
                    localStorage.setItem('theme', 'light');
                }
                icon.classList.replace('ph-sun', 'ph-moon');
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                if (localStorage.getItem('consent_personalization') === 'true') {
                    localStorage.setItem('theme', 'dark');
                }
                icon.classList.replace('ph-moon', 'ph-sun');
            }

            // Kirim setelan tema baru ke iframe (GAS.html) agar selaras
            const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            broadcastThemeToIframes(newTheme);
        };

        // Fallback jika browser tidak mendukung View Transitions API
        if (!document.startViewTransition) {
            toggleTheme();
            return;
        }

        // Dapatkan koordinat klik untuk titik awal lingkaran
        const x = e.clientX || (e.touches && e.touches[0].clientX) || toggleBtn.getBoundingClientRect().left;
        const y = e.clientY || (e.touches && e.touches[0].clientY) || toggleBtn.getBoundingClientRect().top;

        // Hitung jarak maksimum ke sudut layar untuk radius akhir
        const endRadius = Math.hypot(
            Math.max(x, innerWidth - x),
            Math.max(y, innerHeight - y)
        );

        // Mulai transisi
        const transition = document.startViewTransition(() => {
            toggleTheme();
        });

        // Terapkan animasi lingkaran setelah DOM siap
        transition.ready.then(() => {
            const clipPath = [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
            ];

            document.documentElement.animate(
                {
                    clipPath: clipPath,
                },
                {
                    duration: 500,
                    easing: 'ease-out',
                    pseudoElement: '::view-transition-new(root)'
                }
            );
        });
    });
}

function broadcastThemeToIframes(theme) {
    const iframes = [
        document.getElementById('upload-iframe'),
        document.getElementById('upload-modal-iframe')
    ];

    // Broadcast fallback untuk iframe standar
    iframes.forEach(iframe => {
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'theme', value: theme }, '*');
        }
    });

    // Broadcast langsung ke iframe dalam (GAS bersarang) via event.source
    gasIframeSources.forEach(source => {
        try {
            source.postMessage({ type: 'theme', value: theme }, '*');
        } catch (e) {
            gasIframeSources.delete(source); // Hapus jika sudah dead/unreachable
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const iframes = ['upload-iframe', 'upload-modal-iframe'];
    iframes.forEach(id => {
        const iframe = document.getElementById(id);
        if (iframe) {
            iframe.addEventListener('load', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
                broadcastThemeToIframes(currentTheme);
            });
        }
    });
});

// Simpan referensi ke window iframe dalam yang berasal dari GAS (script.googleusercontent.com)
const gasIframeSources = new Set();

// Dengarkan pesan dari iframe (GAS.html) saat ia meminta tema awal
window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'themeRequest') {
        const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        // Simpan source window untuk komunikasi dua arah yang menembus iframe perantara Google
        if (event.source) {
            gasIframeSources.add(event.source);
            event.source.postMessage({ type: 'theme', value: currentTheme }, '*');
        }
    } else if (event.data && event.data.type === 'refresh') {
        // Memicu autosinkronisasi sebelum merefresh halaman secara paksa
        if (SYNC_SCRIPT_URL && SYNC_SCRIPT_URL !== 'MASUKKAN_URL_WEB_APP_DISINI') {
            console.log("Triggering forced sync before refresh...");
            fetch(SYNC_SCRIPT_URL)
                .then(res => res.json())
                .then(data => {
                    console.log("Forced Sync Complete:", data);
                    window.location.reload();
                })
                .catch(err => {
                    console.error("Forced Sync Error:", err);
                    window.location.reload(); // Tetap refresh meski gagal
                });
        } else {
            window.location.reload();
        }
    }
});

// 2. Data Fetching & Parsing
async function initData() {
    // Jalankan Sinkronisasi Materi di Latar Belakang (Non-blocking)
    if (SYNC_SCRIPT_URL && SYNC_SCRIPT_URL !== 'MASUKKAN_URL_WEB_APP_DISINI') {
        fetch(SYNC_SCRIPT_URL)
            .then(res => res.json())
            .then(data => console.log("Auto-Sync Response:", data))
            .catch(err => console.error("Auto-Sync Error:", err));
    }

    const dashboardStats = document.getElementById('total-courses');
    if (dashboardStats) dashboardStats.innerText = '...';

    // Tentukan semester dari URL/localStorage SEBELUM fetch data, agar UI tidak "flash"
    let savedSemester;
    if (window.location.hash) {
        const hash = window.location.hash.substring(1); // Remove '#'
        if (hash.startsWith('semester')) {
            // Ambil bagian pertama sebelum '/' jika ada (contoh: semester2/Bahasa Inggris)
            savedSemester = hash.split('/')[0].replace('semester', '');
        }
    }
    if (!savedSemester) {
        if (localStorage.getItem('consent_personalization') === 'true') {
            savedSemester = localStorage.getItem('semester') || '1';
        } else {
            savedSemester = '1';
        }
    }

    const semesterSelect = document.getElementById('semester-filter');
    if (semesterSelect) {
        semesterSelect.value = savedSemester;
    }

    try {
        // Fetch semua data secara paralel
        const [coursesRes, materialsRes, assignmentsRes, arsipFotoRes, mahasiswaRes] = await Promise.all([
            fetch(COURSES_SHEET_URL).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(MATERIALS_SHEET_URL).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(ASSIGNMENTS_SHEET_URL).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(ARSIP_FOTO_SHEET_URL).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(MAHASISWA_SHEET_URL).then(r => r.ok ? r.text() : '').catch(() => '')
        ]);

        coursesData = parseCSV(coursesRes);
        materialsData = parseCSV(materialsRes);
        assignmentsData = parseCSV(assignmentsRes);
        arsipFotoData = parseCSV(arsipFotoRes);
        mahasiswaData = parseCSV(mahasiswaRes);

        // Render UI setelah data siap
        loadDashboard(savedSemester);
        loadAssignments(savedSemester);
        renderBookmarks(savedSemester); // Tampilkan bookmark tersimpan sesuai semester
        loadCourses(savedSemester);

        // Panggil routing hash setelah semua data dipastikan termuat
        checkHashRoute();

    } catch (error) {
        console.error("Gagal memuat data:", error);
        // Fallback jika fetch gagal (opsional: tampilkan pesan error di UI)
        document.getElementById('course-grid').innerHTML = '<p style="color:red; text-align:center; grid-column:1/-1;">Gagal memuat data dari Google Sheets. Periksa koneksi atau URL.</p>';
    } finally {
        // Sembunyikan loading overlay setelah selesai (sukses/gagal)
        const loader = document.getElementById('loading-overlay');
        if (loader) loader.classList.add('hidden');

        // Mulai interval penyegaran data hanya sekali setelah load awal
        if (!window.dataRefreshInterval) {
            window.dataRefreshInterval = setInterval(refreshData, 60000); // 60000 ms = 1 menit
        }
    }
}

async function refreshData() {
    // Lewati penyegaran jika pengguna sedang di halaman Undi Kelompok (mengganggu perputaran roda)
    if (window.location.hash === '#undi') {
        return;
    }

    console.log("Menyegarkan data dari Google Sheets (Latar Belakang)...");

    // Dapatkan semester yang sedang aktif dari dropdown
    const semesterSelect = document.getElementById('semester-filter');
    const currentSemester = semesterSelect ? semesterSelect.value : '1';

    try {
        // Tambahkan parameter unik untuk mencegah cache browser
        const cacheBuster = '&t=' + new Date().getTime();

        // Fetch semua data secara paralel
        const [coursesRes, materialsRes, assignmentsRes, arsipFotoRes, mahasiswaRes] = await Promise.all([
            fetch(COURSES_SHEET_URL + cacheBuster).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(MATERIALS_SHEET_URL + cacheBuster).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(ASSIGNMENTS_SHEET_URL + cacheBuster).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(ARSIP_FOTO_SHEET_URL + cacheBuster).then(r => r.ok ? r.text() : '').catch(() => ''),
            fetch(MAHASISWA_SHEET_URL + cacheBuster).then(r => r.ok ? r.text() : '').catch(() => '')
        ]);

        // Update state data global
        coursesData = parseCSV(coursesRes);
        materialsData = parseCSV(materialsRes);
        assignmentsData = parseCSV(assignmentsRes);
        arsipFotoData = parseCSV(arsipFotoRes);
        mahasiswaData = parseCSV(mahasiswaRes);

        // Render ulang UI dengan data baru tanpa reload halaman
        loadDashboard(currentSemester);
        loadAssignments(currentSemester);
        renderBookmarks(currentSemester);
        loadCourses(currentSemester);

        // Jika modal materi sedang terbuka, render ulang kontennya juga agar data tetap sinkron
        if (activeCourse && document.getElementById('material-modal').classList.contains('active')) {
            const activeTabBtn = document.querySelector('#material-modal .tab-btn.active');
            if (activeTabBtn) {
                renderModalContent(activeTabBtn.dataset.tab);
            }
        }

        console.log("Data berhasil disegarkan.");

    } catch (error) {
        console.error("Gagal menyegarkan data:", error);
    }
}

function parseCSV(csvText) {
    if (!csvText || csvText.trim() === '') return [];
    if (csvText.trim().toLowerCase().startsWith('<')) return []; // Handle HTML response gracefully

    // Parser CSV yang lebih kuat untuk menangani baris baru di dalam sel (multiline)
    const rows = [];
    let currentRow = [];
    let currentVal = '';
    let inQuote = false;

    // Normalisasi baris baru (\r\n -> \n)
    csvText = csvText.replace(/\r\n/g, '\n');

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (inQuote && nextChar === '"') { // Handle escaped quote ""
                currentVal += '"';
                i++;
            } else {
                inQuote = !inQuote;
            }
        } else if (char === ',' && !inQuote) {
            currentRow.push(currentVal);
            currentVal = '';
        } else if (char === '\n' && !inQuote) {
            currentRow.push(currentVal);
            rows.push(currentRow);
            currentRow = [];
            currentVal = '';
        } else {
            currentVal += char;
        }
    }
    if (currentRow.length > 0 || currentVal) {
        currentRow.push(currentVal);
        rows.push(currentRow);
    }

    if (rows.length === 0) return [];

    const headers = rows[0].map(h => h.trim().replace(/^"|"$/g, ''));
    return rows.slice(1).filter(row => row.length === headers.length).map(values => {
        const row = {};
        headers.forEach((header, index) => {
            // Hapus kutip di awal/akhir dari setiap nilai dan trim spasi
            // Translasi literal '\n' string kembali menjadi karakter newline sebenarnya
            let val = (values[index] || '').replace(/^"|"$/g, '').trim();
            row[header] = val.replace(/\\n/g, '\n');
        });
        return row;
    });
}

// 3. Assignment Logic (Group by Date)
function loadAssignments(semesterFilter) {
    const listContainer = document.getElementById('assignment-list');
    listContainer.innerHTML = '';

    // --- Filter Tugas Aktif (Deadline belum lewat) ---
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set ke awal hari untuk perbandingan tanggal

    const formatDate = (d) => {
        const dateObj = parseDateStr(d);
        if (!dateObj) return d;
        return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Filter Course berdasarkan Semester
    const validCourses = (!semesterFilter || semesterFilter === 'all')
        ? coursesData.map(c => c.name)
        : coursesData.filter(c => c.semester == semesterFilter).map(c => c.name);

    const activeAssignments = assignmentsData.filter(task => {
        // Cek apakah mata kuliah ada di semester ini
        if (!validCourses.includes(task.course)) return false;

        const deadlineDate = parseDateStr(task.deadline);
        const createdDate = parseDateStr(task.date);

        if (deadlineDate) {
            // Jika ada deadline, harus hari ini atau masa depan
            return deadlineDate.getTime() >= today.getTime();
        }

        // Jika tidak ada deadline, cek umur tugas (maks 30 hari)
        if (createdDate) {
            const age = (today - createdDate) / (1000 * 60 * 60 * 24);
            return age <= 30;
        }

        return false;
    });

    // --- Group active assignments by course ---
    const groupedByCourse = {};
    activeAssignments.forEach(task => {
        const courseName = (task.course || 'Tanpa Nama').trim();
        if (!groupedByCourse[courseName]) {
            groupedByCourse[courseName] = {
                course: courseName,
                tasks: [],
                deadlines: []
            };
        }
        groupedByCourse[courseName].tasks.push(task);
        if (task.deadline) {
            groupedByCourse[courseName].deadlines.push(task.deadline);
        }
    });

    // Convert to array and sort by the nearest deadline within each group
    const sortedGroups = Object.values(groupedByCourse).sort((a, b) => {
        const earliestA = Math.min(...a.tasks.map(t => (parseDateStr(t.deadline) || Infinity)));
        const earliestB = Math.min(...b.tasks.map(t => (parseDateStr(t.deadline) || Infinity)));
        return earliestA - earliestB;
    });

    if (activeAssignments.length === 0) {
        listContainer.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Tidak ada tugas aktif</div>';
        document.getElementById('total-assignments').innerText = '0';
        return;
    }

    // Render Top 5 Course Groups
    listContainer.innerHTML = sortedGroups.slice(0, 5).map(group => {
        // Prepare data for modal
        const modalData = {
            date: group.tasks[0]?.date, // Use date from the first task in the group
            tasks: group.tasks
        };
        const encodedData = encodeURIComponent(JSON.stringify(modalData));

        // Format dan Dedup Deadline
        const uniqueDeadlines = [...new Set(group.deadlines)];
        const sortedDeadlines = uniqueDeadlines.sort((a, b) => {
            return (parseDateStr(a) || 0) - (parseDateStr(b) || 0);
        });

        const deadlineText = sortedDeadlines.length > 0
            ? `Deadline: ${sortedDeadlines.map(d => formatDate(d)).join(', ')}`
            : 'Klik untuk detail';

        return `
        <a href="#" class="assignment-item" onclick="openAssignmentModal('${encodedData}'); return false;">
            <i class="ph ph-file-text assignment-icon"></i>
            <div style="flex: 1;">
                <div style="font-weight:600; line-height: 1.2;">${group.course} (${group.tasks.length} tugas)</div>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top: 2px;">${deadlineText}</div>
            </div>
        </a>
        `;
    }).join('');

    document.getElementById('total-assignments').innerText = activeAssignments.length;
}

function openAssignmentModal(encodedData) {
    try {
        const data = JSON.parse(decodeURIComponent(encodedData));

        // Isi Data ke Modal
        document.getElementById('assign-modal-date').innerText = data.date || '-';

        const listContainer = document.getElementById('assign-modal-list');

        // Helper Format Tanggal untuk Tampilan
        const formatDate = (d) => {
            if (!d) return '-';
            const parts = d.trim().replace(/\//g, '-').split('-');
            if (parts.length !== 3) return d;

            let [p1, p2, p3] = parts.map(n => parseInt(n, 10));
            let dateObj;

            // Cek format YYYY-MM-DD
            if (p1 > 31) {
                dateObj = new Date(p1, p2 - 1, p3);
            } else {
                // Asumsi DD-MM-YYYY
                if (p3 < 100) p3 += 2000;
                dateObj = new Date(p3, p2 - 1, p1);
            }

            if (isNaN(dateObj.getTime())) return d;
            return dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        };

        if (data.tasks && data.tasks.length > 0) {
            listContainer.innerHTML = data.tasks.map(t => `
                <div class="file-item" style="display:block; margin-bottom:1rem;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; align-items: flex-start;">
                        <strong style="color:var(--brand-color); font-size:1.1rem;">${t.course}</strong>
                        <span class="badge" style="background:var(--danger); color:white; padding: 0.25rem 0.75rem; border-radius: 50px; font-size: 0.8rem;">Deadline: ${formatDate(t.deadline)}</span>
                    </div>
                    <div style="font-size:0.9rem; margin-bottom:0.5rem;"><strong>Dosen:</strong> ${t.lecturer}</div>
                    <div style="background:var(--bg-color); padding:0.8rem; border-radius:6px; font-size:0.95rem; white-space: pre-wrap;">${t.description}</div>
                    ${t.note ? (function () {
                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const linkedNote = t.note.replace(urlRegex, '<a href="$1" target="_blank" style="color:inherit; text-decoration:underline;">$1</a>');
                    return `
                        <div style="margin-top: 1rem; border-top: 1px dashed rgba(230, 126, 34, 0.3); padding-top: 0.75rem;">
                            <div style="font-weight: bold; color: #e67e22; font-size: 0.85rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
                                <i class="ph ph-note"></i> Catatan/Link Penting:
                            </div>
                            <div style="background: rgba(230, 126, 34, 0.05); padding: 0.8rem; border-radius: 6px; font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap; border-left: 3px solid #e67e22;">${linkedNote}</div>
                        </div>
                        `;
                })() : ''}
                    
                    <div style="margin-top: 0.5rem; text-align: right;">
                        <button onclick="toggleBookmark('${generateId(t)}', 'tugas', '${t.course} - ${t.description.substring(0, 20)}...', 'Deadline: ${t.deadline}', null, 'tugas', event)" class="list-bookmark-btn" title="Simpan" style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: var(--bg-color); border: 1px solid var(--border-color);">
                            <i class="${isBookmarked(generateId(t)) ? 'ph-fill' : 'ph'} ph-star" 
                               style="color: ${isBookmarked(generateId(t)) ? 'var(--accent-color)' : 'var(--text-secondary)'}; font-size: 1.25rem;"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            listContainer.innerHTML = '<p>Tidak ada daftar tugas.</p>';
        }

        document.getElementById('assignment-modal').classList.add('active');
    } catch (e) {
        alert("Gagal memuat tugas: " + e.message);
    }
}

// Helper ID Generator
function generateId(obj) {
    // Buat ID unik menggunakan fungsi hash sederhana pada representasi string dari objek.
    // Metode btoa(string).substring() sebelumnya sangat rentan terhadap kolisi (ID yang sama untuk item berbeda),
    // yang menyebabkan bug pada fitur bookmark.
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return 'id' + Math.abs(hash); // Gunakan Math.abs untuk menghindari ID negatif dan memastikan konsistensi
}

// 4. Course Logic
function loadCourses(semesterFilter) {
    const grid = document.getElementById('course-grid');
    grid.innerHTML = ''; // Clear

    // Filter Data
    const filtered = semesterFilter === 'all'
        ? coursesData
        : coursesData.filter(c => c.semester == semesterFilter);

    // Render Cards
    filtered.forEach(course => {
        // Hitung jumlah file untuk course ini dari materialsData
        const fileCount = materialsData.filter(m => m.course === course.name).length;

        const card = document.createElement('div');
        card.className = 'course-card';
        card.innerHTML = `
            <span class="course-tag">Sem ${course.semester}</span>
            <div class="course-icon">
                <i class="ph ph-book-bookmark" style="font-size: 2rem; color: var(--accent-color);"></i>
            </div>
            <h4 class="course-title">${course.name}</h4>
            <div class="course-dosen">
                <i class="ph ph-user" style="margin-top: 3px;"></i>
                <div>${course.dosen.split(/[\n;]/).map(d => d.trim()).filter(Boolean).join('<br>')}</div>
            </div>
            <div style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-secondary);">
                <i class="ph ph-folder-notch"></i> ${fileCount} Materi Tersedia
            </div>
        `;

        // Event Click Card -> Buka Modal
        card.addEventListener('click', () => openCourseModal(course));
        grid.appendChild(card);
    });

    // Update Dashboard Stat
    // Stat ini sekarang di-update oleh loadDashboard()
}

function loadDashboard(semesterFilter) {
    const filteredCourses = semesterFilter === 'all'
        ? coursesData
        : coursesData.filter(c => c.semester == semesterFilter);
    document.getElementById('total-courses').innerText = filteredCourses.length;
}

// 5. Modal & Search Logic
function setupEventListeners() {
    // Main Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const mainMenu = document.getElementById('main-menu');
    const closeMenuBtn = document.getElementById('close-main-menu');
    const menuOverlay = document.getElementById('menu-overlay');

    const openMenu = () => {
        if (menuToggle.classList.contains('back-btn-mode')) return; // Mencegah menu terbuka jika tombol sedang menjadi tombol back
        mainMenu.classList.add('active');
        menuOverlay.classList.add('active');
    };
    const closeMenu = () => {
        mainMenu.classList.remove('active');
        menuOverlay.classList.remove('active');
    };

    menuToggle.addEventListener('click', openMenu);
    closeMenuBtn.addEventListener('click', closeMenu);
    menuOverlay.addEventListener('click', closeMenu);

    // Menu Links
    document.getElementById('menu-beranda').addEventListener('click', closeMenu);
    document.getElementById('menu-arsip-foto').addEventListener('click', (e) => {
        e.preventDefault();
        openGlobalPhotoArchive();
        closeMenu();
    });
    document.getElementById('menu-pengaturan').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('manage-cookies-btn').click(); // Trigger cookie modal
        closeMenu();
    });

    // Notification/Info Panel Toggle
    const notifBtn = document.getElementById('notif-toggle');
    const infoPanel = document.getElementById('info-panel');
    const infoPanelBody = document.getElementById('info-panel-body');
    const infoPanelClose = document.getElementById('info-panel-close');

    function openInfoPanel() {
        if (infoPanelBody) {
            infoPanelBody.innerHTML = `<div style="text-align:center; padding: 1rem; color: var(--text-secondary); font-size: 0.85rem;"><i class="ph ph-spinner" style="animation: spin 1s linear infinite; font-size:1.2rem;"></i><br>Memuat info...</div>`;
        }
        if (infoPanel) {
            infoPanel.style.display = 'block';
            requestAnimationFrame(() => {
                infoPanel.style.transform = 'translateY(0)';
                infoPanel.style.opacity = '1';
            });
        }
        // Load data from Google Sheets
        fetch(INFO_SHEET_URL)
            .then(r => r.text())
            .then(csv => {
                const rows = csv.trim().split('\n').slice(1); // skip header
                if (!rows.length || (rows.length === 1 && rows[0].trim() === '')) {
                    if (infoPanelBody) infoPanelBody.innerHTML = `<div style="text-align:center; padding:1rem; color:var(--text-secondary); font-size:0.85rem;">Belum ada info terbaru.</div>`;
                    return;
                }
                // Parse rows and sort by date descending (newest first)
                const parsed = rows.map(row => {
                    const cols = row.split(',').map(c => c.replace(/^"|"$/g, '').trim());
                    const [tanggal = '', kategori = '', judul = '', isi = ''] = cols;
                    return { tanggal, kategori, judul, isi };
                }).filter(r => r.judul || r.isi);

                parsed.sort((a, b) => {
                    const parseDate = s => {
                        const [d, m, y] = s.split('-');
                        return y && m && d ? new Date(`${y}-${m}-${d}`) : new Date(0);
                    };
                    return parseDate(b.tanggal) - parseDate(a.tanggal);
                });

                const html = parsed.map(({ kategori, judul, isi }) => `
                    <div style="margin-bottom: 0.85rem; padding-bottom: 0.85rem; border-bottom: 1px solid var(--border-color);">
                        ${kategori ? `<span style="font-size: 0.7rem; font-weight: 700; color: var(--accent-color); text-transform: uppercase; letter-spacing: 0.5px;">${kategori}</span>` : ''}
                        ${judul ? `<div style="font-weight: 600; color: var(--text-primary); font-size: 0.9rem; margin-top: 0.15rem; margin-bottom: 0.15rem;">${judul}</div>` : ''}
                        ${isi ? `<div style="font-size: 0.83rem;">${isi}</div>` : ''}
                    </div>
                `).join('');
                if (infoPanelBody) infoPanelBody.innerHTML = html || `<div style="text-align:center;padding:1rem;color:var(--text-secondary);font-size:0.85rem;">Belum ada info terbaru.</div>`;
            })
            .catch(() => {
                if (infoPanelBody) infoPanelBody.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--text-secondary);font-size:0.85rem;">Gagal memuat info. Coba lagi nanti.</div>`;
            });
    }

    function closeInfoPanel() {
        if (infoPanel) {
            infoPanel.style.transform = 'translateY(-10px)';
            infoPanel.style.opacity = '0';
            setTimeout(() => { infoPanel.style.display = 'none'; }, 250);
        }
    }

    let infoPanelTimeout;
    let infoPanelPinned = false;

    function showPanel() {
        clearTimeout(infoPanelTimeout);
        openInfoPanel();
    }

    function hidePanel() {
        if (infoPanelPinned) return; // jangan tutup jika di-pin
        infoPanelTimeout = setTimeout(() => closeInfoPanel(), 200);
    }

    function closePinnedPanel() {
        infoPanelPinned = false;
        closeInfoPanel();
    }

    if (notifBtn) {
        notifBtn.addEventListener('mouseenter', showPanel);
        notifBtn.addEventListener('mouseleave', hidePanel);
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            infoPanelPinned = !infoPanelPinned;
            if (infoPanelPinned) {
                showPanel(); // pastikan terbuka
            } else {
                closePinnedPanel(); // tutup jika di-unpin
            }
        });
    }

    if (infoPanel) {
        infoPanel.addEventListener('mouseenter', () => clearTimeout(infoPanelTimeout));
        infoPanel.addEventListener('mouseleave', hidePanel);
    }

    if (infoPanelClose) infoPanelClose.addEventListener('click', closePinnedPanel);

    document.addEventListener('click', (e) => {
        if (infoPanelPinned && infoPanel && !infoPanel.contains(e.target) && e.target !== notifBtn) {
            closePinnedPanel();
        }
    });




    // Filter Semester
    document.getElementById('semester-filter').addEventListener('change', (e) => {
        const selectedSemester = e.target.value;
        if (localStorage.getItem('consent_personalization') === 'true') {
            localStorage.setItem('semester', selectedSemester);
        }
        loadCourses(selectedSemester);
        loadDashboard(selectedSemester);
        loadAssignments(selectedSemester);
        renderBookmarks(selectedSemester);

        // Update URL Hash
        window.location.hash = 'semester' + selectedSemester;
    });

    // Search Toggle Mobile
    const searchBar = document.querySelector('.search-bar');
    searchBar.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            // Jangan tutup jika yang diklik adalah input itu sendiri
            if (e.target.tagName === 'INPUT') return;

            searchBar.classList.toggle('active');
            if (searchBar.classList.contains('active')) {
                document.getElementById('global-search').focus();
            }
        }
    });

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !searchBar.contains(e.target)) {
            searchBar.classList.remove('active');
        }
    });

    // Search Global
    document.getElementById('global-search').addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.course-card');

        cards.forEach(card => {
            const text = card.innerText.toLowerCase();
            card.style.display = text.includes(term) ? 'block' : 'none';
        });
    });

    // Close Modal
    document.getElementById('close-material-modal').addEventListener('click', () => {
        const modal = document.getElementById('material-modal');
        modal.classList.remove('active');

        // Kembalikan hash ke semester saja saat modal ditutup
        if (activeCourse) {
            window.location.hash = 'semester' + activeCourse.semester;
        } else {
            window.history.pushState('', document.title, window.location.pathname);
        }
    });

    document.getElementById('close-assign-modal').addEventListener('click', () => {
        document.getElementById('assignment-modal').classList.remove('active');
    });

    // Close Modal by clicking overlay
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');

                // Jika modal yang ditutup adalah modal materi, revert hash
                if (modal.id === 'material-modal' && activeCourse) {
                    window.location.hash = 'semester' + activeCourse.semester;
                }

                // Special handling for preview
                if (modal.id === 'preview-modal') {
                    document.getElementById('preview-frame').src = 'about:blank';
                }
            }
        });
    });

    // Fullscreen Toggle Logic
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const previewModalContent = document.querySelector('#preview-modal .modal-content');
    const previewFrame = document.getElementById('preview-frame');

    if (fullscreenBtn && previewModalContent && previewFrame) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                // Cek apakah sedang tampil gambar (img fallback) atau iframe
                const imgFallback = document.getElementById('preview-img-fallback');
                const isImageMode = imgFallback && imgFallback.style.display !== 'none';

                if (isImageMode) {
                    // Fullscreen img langsung — hanya gambar, tanpa chrome/header
                    imgFallback.requestFullscreen().catch(err => {
                        console.error(`Fullscreen error: ${err.message}`);
                        previewModalContent.requestFullscreen();
                    });
                } else {
                    previewFrame.requestFullscreen().catch(err => {
                        console.error(`Error enabling fullscreen: ${err.message}`);
                        previewModalContent.requestFullscreen();
                    });
                }
            } else {
                document.exitFullscreen();
            }
        });

        document.addEventListener('fullscreenchange', () => {
            const icon = fullscreenBtn.querySelector('i');
            if (document.fullscreenElement) {
                icon.classList.replace('ph-corners-out', 'ph-corners-in');
                if (document.fullscreenElement === previewModalContent) {
                    previewModalContent.style.borderRadius = '0';
                }
            } else {
                icon.classList.replace('ph-corners-in', 'ph-corners-out');
                previewModalContent.style.borderRadius = '';
            }
        });
    }

    // Tab Switching Logic
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Reset active class
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Render content based on tab
            renderModalContent(e.target.dataset.tab);
        });
    });

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Shortcut: ESC to close any active modal
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');

                // Revert hash jika modal materi ditutup lewat ESC
                if (activeModal.id === 'material-modal' && activeCourse) {
                    window.location.hash = 'semester' + activeCourse.semester;
                }

                // Special handling for preview modal to stop video/content loading
                if (activeModal.id === 'preview-modal') {
                    document.getElementById('preview-frame').src = 'about:blank'; // Stop loading
                }
            }
        }

        // Shortcut: Ctrl + F or Ctrl + K to focus search
        if (e.ctrlKey && (e.key === 'f' || e.key === 'k')) {
            e.preventDefault(); // Prevent default browser search
            const searchInput = document.getElementById('global-search');
            searchInput.focus();
            // Ensure mobile search bar becomes visible
            searchInput.parentElement.classList.add('active');
        }
    });

    // Hash Router Handler (Untuk fitur Spesifik: Upload & Token)
    window.addEventListener('hashchange', checkHashRoute);

    // Default Beranda click (Clear Hash dan Matikan Popups)
    document.getElementById('menu-beranda')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = ''; // defaults to beranda
        closeMenu();
    });

    document.getElementById('menu-arsip-foto')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'arsipfoto';
        closeMenu();
    });

    document.getElementById('menu-pengaturan')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'pengaturan';
        closeMenu();
    });

    document.getElementById('menu-tentang')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'tentang';
        closeMenu();
    });

    document.getElementById('menu-upload')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'upload';
        closeMenu();
    });

    document.getElementById('menu-undi')?.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = 'undi';
        closeMenu();
    });


    document.getElementById('close-token-modal')?.addEventListener('click', () => {
        document.getElementById('token-modal').classList.remove('active');
        window.history.pushState('', document.title, window.location.pathname); // clear hash
    });

    // Undi Settings Toggle (Mobile)
    const undiSettingsBtn = document.getElementById('undi-settings-btn');
    const undiSettingsPanel = document.getElementById('undi-settings-panel');
    if (undiSettingsBtn && undiSettingsPanel) {
        undiSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            undiSettingsPanel.classList.toggle('active');
        });
        document.addEventListener('click', (e) => {
            if (!undiSettingsPanel.contains(e.target) && !undiSettingsBtn.contains(e.target)) {
                undiSettingsPanel.classList.remove('active');
            }
        });
    }
}

// Router Khusus Berbasis Hash Link
function checkHashRoute() {
    let hash = window.location.hash.substring(1);

    // Clear semua class active di sidebar menu
    document.querySelectorAll('.main-menu-links li a').forEach(a => a.classList.remove('active'));

    // BERSERIKAN SEMUA MODAL SAAT PINDAH RUTE (Global Cleanup)
    document.getElementById('upload-modal')?.classList.remove('active');
    document.getElementById('cookie-settings-modal')?.classList.remove('active');
    document.getElementById('preview-modal')?.classList.remove('active');

    const matModal = document.getElementById('material-modal');
    if (matModal) {
        matModal.classList.remove('active', 'fullscreen-modal');
        matModal.querySelector('.modal-content')?.classList.remove('fullscreen');
        matModal.querySelector('.modal-header').style.display = 'flex'; // Reset header back to normal
    }

    // Kembalikan header utama ke default
    const navBrand = document.querySelector('.navbar .logo');
    if (navBrand) navBrand.innerHTML = '<span class="accent">F.</span>AGRIELLA';

    // --- Navbar Controls Visibility & State ---
    const searchBar = document.querySelector('.nav-controls .search-bar');
    const undiSettings = document.getElementById('navbar-undi-settings');
    const uploadGuideBtn = document.getElementById('btn-upload-guide-nav');
    const menuToggleIcon = document.querySelector('#menu-toggle i');
    const menuToggleBtn = document.getElementById('menu-toggle');

    // Reset to default state
    if (searchBar) searchBar.style.display = 'flex';
    if (undiSettings) undiSettings.style.display = 'none';
    if (uploadGuideBtn) uploadGuideBtn.style.display = 'none';

    // Reset Menu Toggle to Hamburger
    if (menuToggleIcon) {
        menuToggleIcon.className = 'ph ph-list';
    }
    if (menuToggleBtn) {
        menuToggleBtn.onclick = null; // Remove any custom back actions
        menuToggleBtn.classList.remove('back-btn-mode');
    }

    // 1. Rute Semester (atau kosongan dihitung Beranda)
    if (!hash || hash.startsWith('semester')) {
        const btn = document.getElementById('menu-beranda');
        if (btn) btn.classList.add('active');

        // Kembalikan tampilan utama (Beranda)
        ['container-arsip-foto', 'container-upload', 'container-undi', 'container-tentang', 'container-panduan-upload'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Tampilkan content-area utama (course list)
        const mainContent = document.querySelector('.content-area:not(#container-arsip-foto):not(#container-upload):not(#container-undi):not(#container-tentang):not(#container-panduan-upload)');
        if (mainContent) mainContent.style.display = 'block';

        // Tampilkan sidebar kembali
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.display = 'flex';

        // Kembalikan lebar grid layout
        const mainLayout = document.querySelector('.main-layout');
        if (mainLayout) mainLayout.style.gridTemplateColumns = '';

        // --- DEEP LINK COURSE MODAL ---
        // Jika ada bagian kedua setelah '/', itu adalah nama Matkul (contoh: #semester2/Bahasa%20Inggris)
        const parts = hash.split('/');
        if (parts.length > 1) {
            const courseName = decodeURIComponent(parts[1]);
            // Cari matkul di data yang sudah diload
            const course = coursesData.find(c => c.name === courseName);
            if (course) {
                // Gunakan timeout sedikit agar UI beranda sempat render sebentar
                setTimeout(() => {
                    openCourseModal(course);
                }, 100);
            }
        }
    }
    else if (hash === 'upload') {
        const uploadBtn = document.getElementById('menu-upload');
        if (uploadBtn) uploadBtn.classList.add('active');

        if (searchBar) searchBar.style.display = 'none';
        if (uploadGuideBtn) uploadGuideBtn.style.display = 'flex';

        const uploadModal = document.getElementById('upload-modal');
        if (uploadModal) uploadModal.classList.add('active');
        const iframe = document.getElementById('upload-modal-iframe');
        if (iframe && iframe.src === 'about:blank' || iframe.src === window.location.href) {
            const currentTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            iframe.src = UPLOAD_IFRAME_URL + '?theme=' + currentTheme;
        }
    }
    // 3. Rute Pengaturan
    else if (hash === 'pengaturan') {
        const pengaturanBtn = document.getElementById('menu-pengaturan');
        if (pengaturanBtn) pengaturanBtn.classList.add('active');

        const settingsModal = document.getElementById('cookie-settings-modal');
        if (settingsModal) settingsModal.classList.add('active');
    }
    // 4. Rute Arsip Foto
    else if (hash.startsWith('arsipfoto')) {
        const arsipFotoBtn = document.getElementById('menu-arsip-foto');
        if (arsipFotoBtn) arsipFotoBtn.classList.add('active');

        // Ubah header utama
        const navBrand = document.querySelector('.navbar .logo');
        if (navBrand) navBrand.innerHTML = '<span class="accent">Arsip</span> Foto';

        // Ekstrak parameter dari hash: arsipfoto/Semester/NamaAlbum
        const parts = hash.split('/');
        const targetSem = parts[1] ? decodeURIComponent(parts[1]) : null;
        const targetMk = parts[2] ? decodeURIComponent(parts[2]) : null;

        openGlobalPhotoArchive(targetSem, targetMk);
    }
    // 5. Rute Undi Kelompok Acak
    else if (hash === 'undi') {
        const undiBtn = document.getElementById('menu-undi');
        if (undiBtn) undiBtn.classList.add('active');

        // Hide all containers safely, then show undi
        ['container-arsip-foto', 'container-upload', 'container-tentang', 'container-panduan-upload'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Sembunyikan content-area utama (course list)
        const mainContent = document.querySelector('.content-area:not(#container-arsip-foto):not(#container-upload):not(#container-undi):not(#container-tentang):not(#container-panduan-upload)');
        if (mainContent) mainContent.style.display = 'none';

        // Sembunyikan sidebar dan luaskan grid
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.display = 'none';

        const mainLayout = document.querySelector('.main-layout');
        if (mainLayout) mainLayout.style.gridTemplateColumns = '1fr';

        // Tampilkan container Undi
        const undiContainer = document.getElementById('container-undi');
        if (undiContainer) undiContainer.style.display = 'block';

        const navBrand = document.querySelector('.navbar .logo');
        if (navBrand) navBrand.innerHTML = '<span class="accent">Spi</span>n';

        // Swap search bar with undi settings gear in navbar
        if (searchBar) searchBar.style.display = 'none';
        if (undiSettings) undiSettings.style.display = 'flex';

        // Trigger initialization UI pengacakan
        if (typeof initSpinUI === 'function') initSpinUI();
    }
    // 6. Rute Tentang
    else if (hash === 'tentang') {
        const tentangBtn = document.getElementById('menu-tentang');
        if (tentangBtn) tentangBtn.classList.add('active');

        // Hide all containers safely, then show tentang
        ['container-arsip-foto', 'container-upload', 'container-undi', 'container-panduan-upload'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Sembunyikan content-area utama (course list)
        const mainContent = document.querySelector('.content-area:not(#container-arsip-foto):not(#container-upload):not(#container-undi):not(#container-tentang):not(#container-panduan-upload)');
        if (mainContent) mainContent.style.display = 'none';

        // Sembunyikan sidebar dan luaskan grid
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.display = 'none';

        const mainLayout = document.querySelector('.main-layout');
        if (mainLayout) mainLayout.style.gridTemplateColumns = '1fr';

        // Tampilkan container Tentang
        const tentangContainer = document.getElementById('container-tentang');
        if (tentangContainer) tentangContainer.style.display = 'block';

        const navBrand = document.querySelector('.navbar .logo');
        if (navBrand) navBrand.innerHTML = '<span class="accent">Tentang</span> Project';
        if (searchBar) searchBar.style.display = 'none';

        // Load tentang.md info
        loadTentangContent();
    }
    // 7. Rute Panduan Upload
    else if (hash === 'panduan-upload') {
        // Hide all containers safely
        ['container-arsip-foto', 'container-upload', 'container-undi', 'container-tentang'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // Sembunyikan content-area utama (course list)
        const mainContent = document.querySelector('.content-area:not(#container-arsip-foto):not(#container-upload):not(#container-undi):not(#container-tentang):not(#container-panduan-upload)');
        if (mainContent) mainContent.style.display = 'none';

        // Sembunyikan sidebar dan luaskan grid
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.style.display = 'none';

        const mainLayout = document.querySelector('.main-layout');
        if (mainLayout) mainLayout.style.gridTemplateColumns = '1fr';

        // Tampilkan container Panduan Upload
        const panduanContainer = document.getElementById('container-panduan-upload');
        if (panduanContainer) panduanContainer.style.display = 'block';

        const navBrand = document.querySelector('.navbar .logo');
        if (navBrand) navBrand.innerHTML = '<span class="accent">Panduan</span> Upload';
        if (searchBar) searchBar.style.display = 'none';

        // Ubah Hamburger Menu jadi tombol Back
        if (menuToggleIcon) menuToggleIcon.className = 'ph ph-arrow-left';
        if (menuToggleBtn) {
            menuToggleBtn.classList.add('back-btn-mode');
            menuToggleBtn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();
                window.location.hash = 'upload';
            };
        }

        // Load panduan.md info
        loadPanduanUploadContent();
    }
}

// Fungsi load Markdown secara sederhana tanpa library eksternal
async function loadTentangContent() {
    const contentDiv = document.getElementById('tentang-content');
    if (contentDiv.dataset.loaded === 'true') return; // Cukup load 1x

    try {
        const response = await fetch('docs/tentang.md');
        if (!response.ok) throw new Error('File tidak ditemukan');
        let text = await response.text();

        // Simple Markdown Parser
        text = text
            .replace(/^### (.*$)/gim, '<h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--brand-color);">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--brand-color); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 style="color: var(--brand-color); margin-bottom: 1rem;">$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2' target='_blank' style='color: var(--accent-color); text-decoration: none; font-weight: 600;'>$1</a>")
            .replace(/\n\n/gim, '</p><p style="margin-bottom: 1rem;">')
            .replace(/\n- (.*)/gim, '<ul><li style="margin-bottom: 0.5rem;">$1</li></ul>')
        // .replace(/<\/ul>\s*<ul>/gim, ''); // Merge lists

        contentDiv.innerHTML = `<div style="font-size: 1.05rem;"><p>${text}</p></div>`;
        contentDiv.dataset.loaded = 'true';
    } catch (error) {
        contentDiv.innerHTML = '<p style="color:var(--danger); text-align:center;"><i class="ph ph-warning-circle" style="font-size: 2rem;"></i><br>Gagal memuat halaman tentang (tentang.md tidak ditemukan).</p>';
    }
}

async function loadPanduanUploadContent() {
    const contentDiv = document.getElementById('panduan-upload-content');
    if (!contentDiv || contentDiv.dataset.loaded === 'true') return;

    try {
        const response = await fetch('docs/Panduan_Upload.md');
        if (!response.ok) throw new Error('File tidak ditemukan');
        let text = await response.text();

        text = text
            // Horizontal rule
            .replace(/^---$/gim, '<hr style="margin: 2rem 0; border: 0; border-top: 1px dashed var(--border-color);">')
            // Headers
            .replace(/^### (.*$)/gim, '<h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--brand-color);">$1</h3>')
            .replace(/^## (.*$)/gim, '<h2 style="margin-top: 2rem; margin-bottom: 1rem; color: var(--text-primary); border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 style="color: var(--brand-color); margin-bottom: 1rem;">$1</h1>')
            // Bold & Italic
            .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/gim, '<em>$1</em>')
            // Links
            .replace(/\[(.*?)\]\((.*?)\)/gim, "<a href='$2' target='_blank' style='color: var(--accent-color); text-decoration: none; font-weight: 600;'>$1</a>")
            // Inline code
            .replace(/`(.*?)`/gim, '<code style="background: var(--card-bg); color: var(--accent-color); padding: 2px 6px; border: 1px solid var(--border-color); border-radius: 4px; font-size: 0.9em; font-family: monospace;">$1</code>')
            // Tables (rows)
            .replace(/^\|(.*)\|[\s]*$/gim, function (match, row) {
                if (row.includes('---')) return ''; // Skip separator row

                const cells = row.split('|').map(c => c.trim());
                if (cells[0] === '') cells.shift();
                if (cells[cells.length - 1] === '') cells.pop();

                const isHeader = match.includes('Fitur') || match.includes('Cara 1');

                const cellHtml = cells.map((c) => {
                    if (isHeader) {
                        return `<th style="border: 1px solid var(--border-color); padding: 10px; text-align: left; background: var(--card-bg); font-weight: bold;">${c}</th>`;
                    }
                    return `<td style="border: 1px solid var(--border-color); padding: 10px; text-align: left;">${c}</td>`;
                }).join('');

                return `<tr>${cellHtml}</tr>`;
            })
            // Lists: Ordered and Unordered
            .replace(/^\s*\d+\.\s+(.*$)/gim, '<li style="margin-bottom: 0.5rem; list-style-type: decimal; margin-left: 1.5rem;">$1</li>')
            .replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom: 0.5rem; list-style-type: disc; margin-left: 2.5rem;">$1</li>');

        // Wrap loose <tr> tags into a complete table
        text = text.replace(/(<tr>.*?<\/tr>[\s\n]*)+/gim, function (match) {
            const cleanRows = match.replace(/\n+/g, ''); // Remove newlines inside the table block
            return `<div style="overflow-x: auto; margin: 1.5rem 0;"><table style="width: 100%; border-collapse: collapse; font-size: 0.95rem; border: 1px solid var(--border-color); background: var(--bg-color);"><tbody>${cleanRows}</tbody></table></div>`;
        });

        // Wrap loose <li> tags into <ul> or <ol>. To be safe and simple, we'll just wrap all consecutive <li>s in a <ul>, 
        // since we explicitly defined list-style-type inline above.
        text = text.replace(/(?:<li[^>]*>.*?<\/li>\s*)+/gim, function (match) {
            const cleanList = match.replace(/\n+/g, ''); // strip internal newlines to avoid p tag breaks
            return `<ul style="margin: 1rem 0; padding-left: 0;">${cleanList}</ul>`;
        });

        // Final step: convert double newlines to paragraphs
        text = text.split('\n\n').filter(p => p.trim() !== '').map(p => {
            // Don't wrap if it's already a block tag (like h1, h2, h3, hr, div, ul)
            if (/^<(h\d|hr|div|ul|table|li)(.|\n)*>/.test(p.trim())) return p;
            return `<p style="margin-bottom: 1rem;">${p}</p>`;
        }).join('');

        contentDiv.innerHTML = `<div style="font-size: 1.05rem;">${text}</div>`;
        contentDiv.dataset.loaded = 'true';
    } catch (error) {
        contentDiv.innerHTML = '<p style="color:var(--danger); text-align:center;"><i class="ph ph-warning-circle" style="font-size: 2rem;"></i><br>Gagal memuat panduan upload (Panduan_Upload.md tidak ditemukan).</p>';
    }
}
function openCourseModal(course) {
    activeCourse = course; // Set active course

    // Update URL di address bar agar bisa di-share & di-bookmark
    const mkSlug = encodeURIComponent(course.name);
    window.history.pushState({ course: course.name }, '', `#semester${course.semester}/${mkSlug}`);
    const modal = document.getElementById('material-modal');
    const tabs = document.querySelector('.modal-tabs');
    const titleEl = document.getElementById('modal-title');
    modal.querySelector('.modal-header').style.display = 'flex';
    titleEl.innerText = course.name;

    const metaContainer = document.getElementById('modal-meta-container');
    const dosenList = course.dosen.split(/[\n;]/).map(d => d.trim()).filter(Boolean);
    const picList = course.pic ? course.pic.split(',').map(p => p.trim()).filter(Boolean) : [];

    let metaHtml = '<div class="modal-meta-grid">';

    // Dosen Column
    if (dosenList.length > 0) {
        metaHtml += `
            <div class="meta-column">
                <h4>Dosen</h4>
                <ul>${dosenList.map(d => `<li>${d}</li>`).join('')}</ul>
            </div>
        `;
    }

    // PIC Column
    if (picList.length > 0) {
        metaHtml += `
            <div class="meta-column">
                <h4>Penanggung Jawab</h4>
                <ul>${picList.map(p => `<li>${p}</li>`).join('')}</ul>
            </div>
        `;
    }

    metaHtml += '</div>';
    metaContainer.innerHTML = metaHtml;

    tabs.style.display = 'flex'; // Pastikan tab terlihat
    // Reset Tabs ke Default (Dokumen)
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="dokumen"]').classList.add('active');

    // Render Default Content
    renderModalContent('dokumen');

    modal.classList.remove('fullscreen-modal'); // Kembalikan posisi z-index layer
    modal.querySelector('.modal-content').classList.remove('fullscreen'); // Kembalikan default styling
    modal.classList.add('active');
}

function openGlobalPhotoArchive(targetSem = null, targetMk = null) {
    const modal = document.getElementById('material-modal');
    const title = document.getElementById('modal-title');
    const metaContainer = document.getElementById('modal-meta-container');
    const tabs = document.querySelector('.modal-tabs');
    const fileContainer = document.getElementById('modal-files');

    modal.querySelector('.modal-header').style.display = 'none';
    metaContainer.innerHTML = ''; // Sembunyikan meta
    tabs.style.display = 'none'; // Sembunyikan tabs

    const photos = materialsData.filter(m => ['image', 'jpg', 'png', 'jpeg'].includes(m.type));

    // Gabungkan dengan sumber sheet arsipfoto
    const additionalPhotos = arsipFotoData.filter(m => m.link);
    const allPhotos = [...photos, ...additionalPhotos];

    modal.classList.add('fullscreen-modal'); // Ubah z-index wrapper agar di bawah navbar
    modal.querySelector('.modal-content').classList.add('fullscreen'); // Paksa layar penuh

    // Mengelompokkan berdasarkan Semester dan Mata Kuliah / Album
    const groupedPhotos = {};
    allPhotos.forEach(m => {
        // Cari semester berdasarkan m.course // m.album di coursesData
        const relatedCourse = coursesData.find(c => c.name === m.course || c.name === m.album);
        const sem = relatedCourse && relatedCourse.semester ? relatedCourse.semester : 'Lainnya';
        const mk = m.course || m.album || 'Lain-lain';

        if (!groupedPhotos[sem]) groupedPhotos[sem] = {};
        if (!groupedPhotos[sem][mk]) groupedPhotos[sem][mk] = [];
        groupedPhotos[sem][mk].push(m);
    });

    if (allPhotos.length === 0) {
        fileContainer.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Belum ada foto di arsip.</div>';
    } else {
        let htmlStr = '';

        // Container khusus untuk tombol kembali ke daftar semester
        htmlStr += `<div id="semester-back-nav" style="display: none; align-items:center; gap: 1rem; margin-bottom: 1rem;">
                        <button onclick="closeSemester()" style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; background:var(--card-bg); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius); cursor:pointer; font-weight:600; transition:all 0.2s;">
                            <i class="ph ph-arrow-left"></i> Kembali
                        </button>
                        <div id="active-semester-title" style="display:flex; flex-direction:column; justify-content:center;">
                            <h2 style="color: var(--text-primary); font-size: 1.2rem; margin:0; line-height:1.2;">-</h2>
                        </div>
                    </div>`;

        // Container khusus untuk tombol kembali ke daftar album (dalam satu semester)
        htmlStr += `<div id="album-back-nav" style="display: none; align-items:center; gap: 1rem; margin-bottom: 1rem;">
                        <button onclick="closeAlbum()" style="display:inline-flex; align-items:center; gap:8px; padding:8px 16px; background:var(--card-bg); border:1px solid var(--border-color); color:var(--text-primary); border-radius:var(--radius); cursor:pointer; font-weight:600; transition:all 0.2s;">
                            <i class="ph ph-arrow-left"></i> Kembali
                        </button>
                        <div id="active-album-title" style="display:flex; flex-direction:column; justify-content:center;">
                            <h2 style="color: var(--text-primary); font-size: 1.2rem; margin:0; line-height:1.2;">-</h2>
                            <span style="color: var(--text-secondary); font-size: 0.85rem; margin:0;">-</span>
                        </div>
                    </div>`;

        // Fungsi Buka Semester
        window.openSemester = function (semester) {
            document.getElementById('semester-grid-container').style.display = 'none';
            document.querySelectorAll('.semester-albums-grid').forEach(g => g.style.display = 'none');

            const el = document.getElementById(`semester-${semester}-albums`);
            if (el) el.style.display = 'grid';

            document.getElementById('semester-back-nav').style.display = 'flex';
            document.getElementById('album-back-nav').style.display = 'none';

            // Update teks judul di samping tombol back
            const titleContainer = document.getElementById('active-semester-title');
            if (titleContainer) {
                titleContainer.querySelector('h2').innerText = 'Semester ' + decodeURIComponent(semester).replace(/-/g, ' ');
            }

            window.activeSemesterPhotoArchive = semester;
            window.history.replaceState(null, null, `#arsipfoto/${semester}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        // Fungsi Tutup Semester (Kembali ke Pilih Semester)
        window.closeSemester = function () {
            document.querySelectorAll('.semester-albums-grid').forEach(g => g.style.display = 'none');
            document.getElementById('semester-grid-container').style.display = 'grid';
            document.getElementById('semester-back-nav').style.display = 'none';

            window.activeSemesterPhotoArchive = null;
            window.history.replaceState(null, null, `#arsipfoto`);
        };

        // Fungsi helper navigasi ke dalam album foto
        window.toggleAlbum = function (semester, mk) {
            const el = document.getElementById(`album-${semester}-${mk}`);
            if (el) {
                // Sembunyikan daftar album di semester ini
                document.querySelectorAll('.semester-albums-grid').forEach(g => g.style.display = 'none');
                document.getElementById('semester-back-nav').style.display = 'none';

                // Update teks judul di samping tombol back
                const titleContainer = document.getElementById('active-album-title');
                if (titleContainer) {
                    titleContainer.querySelector('h2').innerText = decodeURIComponent(mk).replace(/-/g, ' ');
                    titleContainer.querySelector('span').innerText = 'Semester ' + decodeURIComponent(semester).replace(/-/g, ' ');
                }

                document.getElementById('semester-back-nav').style.display = 'none';

                // Tampilkan container foto dari album yang dipilih & tombol back
                el.style.display = 'grid';
                document.getElementById('album-back-nav').style.display = 'flex';

                window.history.replaceState(null, null, `#arsipfoto/${semester}/${mk}`);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        };

        // Fungsi untuk kembali ke daftar album
        window.closeAlbum = function () {
            // Sembunyikan semua grid foto
            document.querySelectorAll('.album-photos-grid').forEach(g => g.style.display = 'none');

            // Tampilkan kembali daftar album untuk semester yang aktif
            if (window.activeSemesterPhotoArchive) {
                const el = document.getElementById(`semester-${window.activeSemesterPhotoArchive}-albums`);
                if (el) el.style.display = 'grid';
                document.getElementById('semester-back-nav').style.display = 'block';
                document.getElementById('album-back-nav').style.display = 'none';
                window.history.replaceState(null, null, `#arsipfoto/${window.activeSemesterPhotoArchive}`);
            } else {
                closeSemester();
            }
        };

        // TIER 1: Pilih Semester
        htmlStr += `<div id="semester-grid-container" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:1rem; padding: 0.5rem;">`;

        const sortedSemesters = Object.keys(groupedPhotos).sort((a, b) => {
            if (a === 'Lainnya') return 1;
            if (b === 'Lainnya') return -1;
            return a.localeCompare(b, undefined, { numeric: true });
        });

        sortedSemesters.forEach(sem => {
            const safeSem = sem.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
            const albumKeys = Object.keys(groupedPhotos[sem]);
            const albumCount = albumKeys.length;

            // Cari foto valid pertama di dalam salah satu album semester ini
            let coverSrc = '';
            for (let i = 0; i < albumKeys.length; i++) {
                const mk = albumKeys[i];
                if (groupedPhotos[sem][mk].length > 0) {
                    const firstPhoto = groupedPhotos[sem][mk][0];
                    if (firstPhoto && firstPhoto.link) {
                        coverSrc = firstPhoto.link;
                        break;
                    }
                }
            }

            if (coverSrc && coverSrc.includes('drive.google.com')) {
                const match = coverSrc.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    coverSrc = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                }
            }

            htmlStr += `
                <div class="album-folder" style="cursor:pointer; position: relative; height: 140px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); overflow: hidden; display:flex; align-items:flex-end; box-shadow: var(--shadow); transition: transform 0.2s;" onclick="openSemester('${safeSem}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                    ${coverSrc ? `<img src="${coverSrc}" alt="Cover" loading="lazy" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover; z-index: 0; filter: brightness(0.7);">` : `<div style="position: absolute; top:0; left:0; width:100%; height:100%; background: var(--border-color); z-index: 0; display:flex; align-items:center; justify-content:center;"><i class="ph ph-images" style="font-size:2.5rem; color:var(--text-secondary);"></i></div>`}
                    <div style="position: relative; z-index: 1; padding: 0.8rem; width: 100%; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: white; display:flex; flex-direction: column; align-items:flex-start; font-size: 1rem; font-weight:600; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">
                        <div style="display:flex; align-items:center; margin-bottom: 2px;">
                            <i class="ph ph-folder" style="margin-right:8px; color:var(--accent-color);"></i>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Semester ${sem}</span>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 400; color: #ddd;">${albumCount} Album</span>
                    </div>
                </div>`;
        });
        htmlStr += `</div>`;

        // TIER 2: Daftar Album (per semester)
        htmlStr += `<div id="all-semester-albums-container">`;
        sortedSemesters.forEach(sem => {
            const safeSem = sem.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

            htmlStr += `<div id="semester-${safeSem}-albums" class="semester-albums-grid" style="display:none; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:1rem; padding:0.5rem;">`;

            // Loop album
            Object.keys(groupedPhotos[sem]).sort().forEach(mk => {
                const safeMk = mk.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

                // Ambil foto pertama sbg cover album
                const firstPhoto = groupedPhotos[sem][mk][0];
                let coverSrc = firstPhoto && firstPhoto.link ? firstPhoto.link : '';
                if (coverSrc && coverSrc.includes('drive.google.com')) {
                    const match = coverSrc.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) {
                        coverSrc = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                    }
                }

                htmlStr += `
                    <div class="album-folder" style="cursor:pointer; position: relative; height: 140px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius); overflow: hidden; display:flex; align-items:flex-end; box-shadow: var(--shadow); transition: transform 0.2s;" onclick="toggleAlbum('${safeSem}', '${safeMk}')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                        ${coverSrc ? `<img src="${coverSrc}" alt="Cover" loading="lazy" style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit: cover; z-index: 0; filter: brightness(0.7);">` : `<div style="position: absolute; top:0; left:0; width:100%; height:100%; background: var(--border-color); z-index: 0; display:flex; align-items:center; justify-content:center;"><i class="ph ph-image" style="font-size:2rem; color:var(--text-secondary);"></i></div>`}
                        <div style="position: relative; z-index: 1; padding: 0.8rem; width: 100%; background: linear-gradient(transparent, rgba(0,0,0,0.8)); color: white; display:flex; align-items:center; font-size: 1rem; font-weight:600; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">
                            <i class="ph ph-folder" style="margin-right:8px; color:var(--accent-color);"></i>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${mk}</span>
                        </div>
                    </div>`;
            });
            htmlStr += `</div>`;
        });
        htmlStr += `</div>`;

        // TIER 3: Isi Foto-foto dari masing-masing album
        htmlStr += `<div id="all-album-photos-container">`;
        sortedSemesters.forEach(sem => {
            Object.keys(groupedPhotos[sem]).forEach(mk => {
                const safeMk = mk.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
                const safeSem = sem.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

                htmlStr += `
                    <div id="album-${safeSem}-${safeMk}" class="album-photos-grid" style="display: none; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem; padding: 0.5rem;">`;

                // Loop setiap foto
                groupedPhotos[sem][mk].forEach(m => {
                    const dateObj = parseDateStr(m.date) || new Date(m.date || Date.now());
                    const dateDisplay = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                    const fileLink = m.link;

                    let imgSrc = fileLink;
                    if (fileLink && fileLink.includes('drive.google.com')) {
                        const match = fileLink.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                        if (match && match[1]) {
                            imgSrc = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                        }
                    }

                    const previewLink = fileLink ? fileLink.replace(/\/view.*/, '/preview') : '#';
                    const itemId = generateId(m);
                    const bookmarked = isBookmarked(itemId);

                    htmlStr += `
                        <div class="file-item" style="flex-direction: column; align-items: stretch; text-align: center; padding: 0; height: auto; position: relative; background: transparent; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow);">
                            <a href="${fileLink}" onclick="event.preventDefault(); showPreview('${previewLink}', '${m.filename.replace(/'/g, "\\'")}')" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; height: 100%;">
                                <img src="${imgSrc}" alt="${m.filename}" loading="lazy" style="width: 100%; height: 120px; object-fit: cover; background-color: var(--bg-color); border-bottom: 1px solid var(--border-color);">
                                <div style="padding: 0.75rem; background-color: var(--card-bg); flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
                                    <div style="font-weight:600; font-size:0.85rem; word-break: break-word; line-height: 1.3;">${m.filename}</div>
                                    <div style="font-size:0.75rem; color: var(--text-secondary); margin-top: 4px;">${dateDisplay}</div>
                                </div>
                            </a>
                            <button onclick="toggleBookmark('${itemId}', 'materi', '${m.filename.replace(/'/g, "\\'")}', '${m.course}', '${fileLink}', '${m.type}', event)" class="list-bookmark-btn" title="Simpan" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.4); border-radius: 50%; color: white; height: 32px; width: 32px; display: flex; align-items: center; justify-content: center;">
                                <i class="${bookmarked ? 'ph-fill' : 'ph'} ph-star" style="color: ${bookmarked ? 'var(--accent-color)' : 'white'};"></i>
                            </button>
                        </div>`;
                });
                htmlStr += `</div>`; // End of individual album photos grid
            });
        });

        htmlStr += `</div>`; // End of all-album-photos-container

        fileContainer.innerHTML = htmlStr;

        // Auto Open Folder jika ada parameter Target yang masuk
        if (targetSem && targetMk) {
            setTimeout(() => {
                const safeTargetSem = targetSem.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
                const safeTargetMk = targetMk.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');

                window.activeSemesterPhotoArchive = safeTargetSem;
                document.getElementById('semester-grid-container').style.display = 'none';

                const el = document.getElementById(`album-${safeTargetSem}-${safeTargetMk}`);
                if (el && el.style.display === 'none') {
                    window.toggleAlbum(safeTargetSem, safeTargetMk);
                }
            }, 100);
        } else if (targetSem) {
            setTimeout(() => {
                const safeTargetSem = targetSem.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');
                window.openSemester(safeTargetSem);
            }, 100);
        }
    }

    modal.classList.add('active');
}

function renderModalContent(type) {
    const fileContainer = document.getElementById('modal-files');
    const course = activeCourse;

    // 1. Ambil materi dari materialsData yang cocok dengan nama course
    let materials = materialsData.filter(m => m.course === course.name);

    // 2. SORTING: Urutkan berdasarkan tanggal (Lama ke Baru / Terbaru di Bawah)
    materials.sort((a, b) => {
        const dateA = parseDateStr(a.date) || new Date(0);
        const dateB = parseDateStr(b.date) || new Date(0);
        if (dateA - dateB !== 0) return dateA - dateB;
        // Jika tanggal sama, urutkan nama file secara alfabetis
        return a.filename.localeCompare(b.filename, 'id', { numeric: true, sensitivity: 'base' });
    });


    // Helper untuk menentukan ikon & warna berdasarkan tipe file
    const getFileIcon = (fileType) => {
        if (fileType === 'youtube') return { icon: 'ph-youtube-logo', color: '#ff0000' };
        if (fileType === 'pdf') return { icon: 'ph-file-pdf', color: '#ef4444' };
        if (fileType === 'doc' || fileType === 'docx') return { icon: 'ph-file-doc', color: '#2563eb' };
        if (fileType === 'ppt' || fileType === 'pptx') return { icon: 'ph-file-ppt', color: '#f59e0b' };
        return { icon: 'ph-file', color: 'var(--text-secondary)' };
    };

    if (type === 'dokumen') {
        // Filter hanya file dokumen (bukan gambar)
        const docs = materials.filter(m => !['image', 'jpg', 'png', 'jpeg'].includes(m.type));

        if (docs.length === 0) {
            fileContainer.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Belum ada dokumen.</div>';
            return;
        }

        // File sudah diurutkan di atas (Date Asc -> Filename Asc)


        fileContainer.innerHTML = docs.map(m => {
            const { icon, color } = getFileIcon(m.type);
            const dateObj = parseDateStr(m.date) || new Date(m.date);
            const dateDisplay = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

            // 1. Buat link download (GitHub Raw)
            // Gunakan link dari CSV jika ada, jika tidak, buat path default ke folder /materi/
            const downloadLink = m.link ? m.link : `https://github.com/FAGRIELLA/FAGRIELLA.github.io/raw/main/materi/${encodeURIComponent(course.name)}/${encodeURIComponent(m.filename)}`;

            // 2. Buat link preview
            let previewLink = downloadLink; // Defaultnya sama dengan link download (untuk gambar, dll)

            // Cek apakah link adalah YouTube
            if (m.type === 'youtube' || downloadLink.includes('youtube.com') || downloadLink.includes('youtu.be')) {
                try {
                    const videoId = downloadLink.includes('youtu.be/')
                        ? downloadLink.split('youtu.be/')[1].split(/[?#]/)[0]
                        : new URL(downloadLink).searchParams.get('v');
                    if (videoId) {
                        previewLink = `https://www.youtube.com/embed/${videoId}`;
                    }
                } catch (e) { /* Abaikan jika URL tidak valid */ }
            }
            // Cek apakah link adalah Google Drive atau Docs
            else if (downloadLink.includes('drive.google.com') || downloadLink.includes('docs.google.com')) {
                const driveIdMatch = downloadLink.match(/\/d\/([a-zA-Z0-9_-]+)/);
                if (driveIdMatch) {
                    const fileId = driveIdMatch[1];
                    previewLink = `https://drive.google.com/file/d/${fileId}/preview`;
                } else {
                    previewLink = downloadLink.replace(/\/(view|edit).*/, '/preview');
                }
            }
            // Jika file office atau PDF biasa (Direct Link), bungkus dengan Google Docs Viewer
            else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf'].includes(m.type)) {
                previewLink = `https://docs.google.com/gview?url=${encodeURIComponent(downloadLink)}&embedded=true`;
            }

            const itemId = generateId(m);
            const bookmarked = isBookmarked(itemId);

            return `
            <div class="file-item" style="display: flex; align-items: center; justify-content: space-between;">
                <a href="${previewLink}" onclick="event.preventDefault(); showPreview(this.href, '${m.filename.replace(/'/g, "\\'")}')" style="display: flex; align-items: center; text-decoration: none; color: inherit; flex: 1; cursor: pointer;">
                    <i class="ph ${icon}" style="font-size:1.5rem; margin-right:10px; color: ${color};"></i>
                    <div>
                        <div style="font-weight:600;">
                            ${m.filename} 
                            <span class="file-size-tag" data-url="${downloadLink}" style="font-weight:400; font-size:0.85em; color:var(--text-secondary);">
                                ${m.size ? `(${m.size})` : ''}
                            </span>
                        </div>
                        <div style="font-size:0.8rem; color: var(--text-secondary);">
                            ${dateDisplay} • Diunggah oleh ${course.pic}
                        </div>
                    </div>
                </a>
                <div style="display: flex; align-items: center;">
                    <button onclick="copyShortLink('${downloadLink}', this)" class="list-bookmark-btn" title="Copy Short Link">
                        <i class="ph ph-link"></i>
                    </button>
                    <a href="${downloadLink}" target="_blank" download class="list-bookmark-btn" title="Download">
                        <i class="ph ph-download-simple"></i>
                    </a>
                    <button onclick="toggleBookmark('${itemId}', 'materi', '${m.filename.replace(/'/g, "\\'")}', '${course.name}', '${downloadLink}', '${m.type}', event)" class="list-bookmark-btn" title="Simpan">
                        <i class="${bookmarked ? 'ph-fill' : 'ph'} ph-star" style="color: ${bookmarked ? 'var(--accent-color)' : 'var(--text-secondary)'}"></i>
                    </button>
                </div>
            </div>
            `;
        }).join('');

        // Trigger auto-detect size untuk file yang belum punya ukuran
        document.querySelectorAll('.file-size-tag').forEach(el => fetchFileSize(el));

    } else if (type === 'foto') {
        // Filter hanya file gambar
        const photos = materials.filter(m => ['image', 'jpg', 'png', 'jpeg'].includes(m.type));

        if (photos.length === 0) {
            fileContainer.innerHTML = '<div style="padding:1rem; text-align:center; color:var(--text-secondary);">Belum ada foto.</div>';
            return;
        }

        // Tampilan Grid untuk Foto
        fileContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1rem;">
                ${photos.map(m => {
            const dateObj = parseDateStr(m.date) || new Date(m.date);
            const dateDisplay = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            const fileLink = m.link; // Link dari Google Sheet

            // Buat URL sumber gambar yang bisa ditampilkan langsung, terutama untuk Google Drive
            let imgSrc = fileLink;
            if (fileLink && fileLink.includes('drive.google.com')) {
                const match = fileLink.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    imgSrc = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                }
            }

            // Buat URL untuk preview di iframe
            const previewLink = fileLink ? fileLink.replace(/\/view.*/, '/preview') : '#';

            const itemId = generateId(m);
            const bookmarked = isBookmarked(itemId);

            return `
                    <div class="file-item" style="flex-direction: column; align-items: stretch; text-align: center; padding: 0; height: auto; position: relative; background: transparent; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow);">
                        <a href="${fileLink}" onclick="event.preventDefault(); showPreview('${previewLink}', '${m.filename.replace(/'/g, "\\'")}')" style="text-decoration: none; color: inherit; display: flex; flex-direction: column; height: 100%;">
                            <img src="${imgSrc}" alt="${m.filename}" loading="lazy" style="width: 100%; height: 120px; object-fit: cover; background-color: var(--bg-color); border-bottom: 1px solid var(--border-color);">
                            <div style="padding: 0.75rem; background-color: var(--card-bg); flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
                                <div style="font-weight:600; font-size:0.85rem; word-break: break-word; line-height: 1.3;">${m.filename}</div>
                                <div style="font-size:0.75rem; color: var(--text-secondary); margin-top: 4px;">${dateDisplay}</div>
                            </div>
                        </a>
                        <button onclick="toggleBookmark('${itemId}', 'materi', '${m.filename.replace(/'/g, "\\'")}', '${course.name}', '${fileLink}', '${m.type}', event)" class="list-bookmark-btn" title="Simpan" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.4); border-radius: 50%; color: white; height: 32px; width: 32px; display: flex; align-items: center; justify-content: center;">
                            <i class="${bookmarked ? 'ph-fill' : 'ph'} ph-star" style="color: ${bookmarked ? 'var(--accent-color)' : 'white'};"></i>
                        </button>
                    </div>
                    `;
        }).join('')}
            </div>
        `;
    }
}

// Helper untuk menghasilkan short link berbasis urutan baris di sheet materials
function generateShortLink(url) {
    const origin = window.location.origin;
    // Cari material berdasarkan URL/link yang cocok
    const idx = materialsData.findIndex(m => m.link === url);
    if (idx !== -1) {
        const m = materialsData[idx];
        const rowNum = idx + 1; // baris data ke-1 = nomor 1
        if (m.link && (m.link.includes('presentation') || m.type === 'ppt' || m.type === 'pptx')) {
            return origin + '/s/#p:' + rowNum;
        } else if (m.link && m.link.includes('spreadsheets')) {
            return origin + '/s/#s:' + rowNum;
        } else if (m.link && m.link.includes('document')) {
            return origin + '/s/#d:' + rowNum;
        }
        return origin + '/s/#' + rowNum;
    }
    // Fallback: encode full URL jika tidak ditemukan di data
    return origin + '/s/#' + encodeURIComponent(url);
}

function copyShortLink(url, btn, e) {
    if (e) e.stopPropagation();
    var short = generateShortLink(url);
    var icon = btn.querySelector('i');

    function onSuccess() {
        if (icon) { icon.className = 'ph ph-check'; }
        setTimeout(function () { if (icon) icon.className = 'ph ph-link'; }, 1500);
    }

    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(short).then(onSuccess).catch(function () {
            prompt('Copy link ini:', short);
            onSuccess();
        });
    } else {
        var textArea = document.createElement('textarea');
        textArea.value = short;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try { document.execCommand('copy'); onSuccess(); }
        catch (err) { prompt('Copy link ini:', short); onSuccess(); }
        document.body.removeChild(textArea);
    }
}

function isBookmarked(id) {
    return bookmarks.some(b => b.id === id);
}

function toggleBookmark(id, type, title, subtitle, link, fileType, event) {
    if (event) event.stopPropagation();

    const index = bookmarks.findIndex(b => b.id === id);
    let isNowBookmarked;

    if (index > -1) {
        // Item ada, hapus dari bookmark
        bookmarks.splice(index, 1);
        isNowBookmarked = false;
    } else {
        // Item tidak ada, tambahkan ke bookmark
        bookmarks.push({ id, type, title, subtitle, link, fileType });
        isNowBookmarked = true;
    }

    if (localStorage.getItem('consent_personalization') === 'true') {
        localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
    }

    // Update ikon yang diklik secara langsung untuk feedback instan, JIKA event ada
    if (event) {
        const icon = event.currentTarget.querySelector('i');
        if (icon) {
            const isPhoto = ['image', 'jpg', 'png', 'jpeg'].includes(fileType);
            if (isNowBookmarked) {
                icon.classList.remove('ph');
                icon.classList.add('ph-fill');
                icon.style.color = 'var(--accent-color)';
            } else {
                icon.classList.remove('ph-fill');
                icon.classList.add('ph');
                // Foto memiliki warna ikon non-aktif yang berbeda (putih)
                icon.style.color = isPhoto ? 'white' : 'var(--text-secondary)';
            }
        }
    }

    // Ambil semester yang sedang aktif dan re-render bookmark list
    const selectedSemester = document.getElementById('semester-filter').value;
    renderBookmarks(selectedSemester);
}

function renderBookmarks(semesterFilter) {
    const list = document.getElementById('bookmark-list');
    if (!list) return;

    if (bookmarks.length === 0) {
        list.innerHTML = '<li class="empty-state" style="color:var(--text-secondary); font-size:0.9rem;">Belum ada bookmark</li>';
        return;
    }

    // Filter Bookmark berdasarkan Semester
    const validCourses = (!semesterFilter || semesterFilter === 'all')
        ? coursesData.map(c => c.name)
        : coursesData.filter(c => c.semester == semesterFilter).map(c => c.name);

    const filteredBookmarks = bookmarks.filter(b => {
        if (b.type === 'materi') return validCourses.includes(b.subtitle); // subtitle = nama matkul
        // Untuk tugas, title adalah "Nama Matkul - Deskripsi..."
        if (b.type === 'tugas') return validCourses.some(c => b.title.startsWith(c));
        return true;
    });

    if (filteredBookmarks.length === 0) {
        list.innerHTML = '<li class="empty-state" style="color:var(--text-secondary); font-size:0.9rem;">Tidak ada bookmark di semester ini</li>';
        return;
    }

    // Pisahkan bookmark foto dan non-foto
    const photoBookmarks = filteredBookmarks.filter(b => b.fileType && ['image', 'jpg', 'png', 'jpeg'].includes(b.fileType));
    const otherBookmarks = filteredBookmarks.filter(b => !photoBookmarks.includes(b));

    let html = '';

    // Render bookmark non-foto (dokumen, tugas) sebagai list
    if (otherBookmarks.length > 0) {
        html += otherBookmarks.map(b => {
            const isLink = b.link && b.link !== 'null';

            // Logic Preview untuk Bookmark
            let href = isLink ? b.link : '#';
            let onclick = '';
            let target = isLink ? 'target="_blank"' : '';

            if (isLink && b.type === 'materi') {
                let previewLink = b.link;
                let canPreview = false;

                // 0. Cek YouTube
                if (b.fileType === 'youtube' || b.link.includes('youtube.com') || b.link.includes('youtu.be')) {
                    try {
                        const videoId = b.link.includes('youtu.be/')
                            ? b.link.split('youtu.be/')[1].split(/[?#]/)[0]
                            : new URL(b.link).searchParams.get('v');
                        if (videoId) {
                            previewLink = `https://www.youtube.com/embed/${videoId}`;
                            canPreview = true;
                        }
                    } catch (e) { /* ignore */ }
                }
                // 1. Google Drive atau Docs
                else if (b.link.includes('drive.google.com') || b.link.includes('docs.google.com')) {
                    const driveIdMatch = b.link.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (driveIdMatch) {
                        const fileId = driveIdMatch[1];
                        previewLink = `https://drive.google.com/file/d/${fileId}/preview`;
                    } else {
                        previewLink = b.link.replace(/\/(view|edit).*/, '/preview');
                    }
                    canPreview = true;
                }
                // 2. Dokumen Office/PDF (Cek ekstensi)
                else {
                    const lowerUrl = b.link.toLowerCase();
                    const lowerTitle = b.title.toLowerCase();
                    const docExts = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];

                    if (docExts.some(ext => lowerUrl.endsWith(ext) || lowerTitle.endsWith(ext))) {
                        previewLink = `https://docs.google.com/gview?url=${encodeURIComponent(b.link)}&embedded=true`;
                        canPreview = true;
                    }
                }

                if (canPreview) {
                    href = previewLink;
                    target = '';
                    onclick = `onclick="event.preventDefault(); showPreview('${previewLink}', '${b.title.replace(/'/g, "\\'")}')"`;
                }
            }

            return `
                <li class="bookmark-item" style="margin-bottom: 0.8rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
                    <a href="${href}" ${target} ${onclick} style="display: block; text-decoration: none; color: var(--text-primary);">
                        <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 2px;">${b.title}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary); display:flex; align-items:center; gap:4px;">
                            <i class="ph-fill ph-star" style="color: var(--accent-color);"></i> ${b.subtitle || ''}
                        </div>
                    </a>
                </li>
            `;
        }).join('');
    }

    // Render bookmark foto sebagai grid
    if (photoBookmarks.length > 0) {
        // Bungkus seluruh bagian grid foto dalam satu <li> agar struktur HTML valid
        html += '<li style="list-style-type: none; padding: 0; border: none;">';
        html += '<h4 class="bookmark-grid-title">Foto Tersimpan</h4>';
        html += '<div class="bookmark-photo-grid">';
        html += photoBookmarks.map(b => {
            let imgSrc = b.link;
            if (imgSrc && imgSrc.includes('drive.google.com')) {
                const match = imgSrc.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    imgSrc = `https://drive.google.com/uc?export=view&id=${match[1]}`;
                }
            }
            const previewLink = b.link ? b.link.replace(/\/(view|edit).*/, '/preview') : '#';

            return `
            <div class="bookmark-photo-item">
                <a href="${previewLink}" onclick="event.preventDefault(); showPreview('${previewLink}', '${b.title.replace(/'/g, "\\'")}')">
                    <img src="${imgSrc}" alt="${b.title}" loading="lazy">
                    <div class="bookmark-photo-title">${b.title}</div>
                </a>
            </div>`;
        }).join('');
        html += '</div></li>'; // Menutup div grid dan li pembungkus
    }

    list.innerHTML = html;
}

function openCourseByName(name) {
    const course = coursesData.find(c => c.name === name);
    if (course) {
        openCourseModal(course);
    }
}

// 7. Preview File Logic
function showPreview(url, title) {
    const modal = document.getElementById('preview-modal');
    const frame = document.getElementById('preview-frame');
    const titleEl = document.getElementById('preview-title');

    titleEl.innerText = title;

    // raw.githubusercontent.com memblokir iframe — tampilkan sebagai <img> langsung
    const isGithubRawImage = (url.includes('raw.githubusercontent.com') || url.includes('github.io')) &&
        /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i.test(url);

    if (isGithubRawImage) {
        frame.src = 'about:blank';
        frame.style.display = 'none';
        // Aktifkan scroll di modal-body untuk gambar
        const modalBody = frame.closest('.modal-body');
        if (modalBody) modalBody.style.overflow = 'auto';
        // Hapus img preview lama jika ada
        let imgEl = document.getElementById('preview-img-fallback');
        if (!imgEl) {
            imgEl = document.createElement('img');
            imgEl.id = 'preview-img-fallback';
            imgEl.style.cssText = 'max-width:100%; display:block; margin:auto; border-radius:8px; padding:8px;';
            frame.parentNode.insertBefore(imgEl, frame);
        }
        imgEl.src = url;
        imgEl.style.display = 'block';
    } else {
        // Sembunyikan img fallback jika ada
        const imgEl = document.getElementById('preview-img-fallback');
        if (imgEl) imgEl.style.display = 'none';
        // Kembalikan overflow ke hidden untuk iframe
        const modalBody = frame.closest('.modal-body');
        if (modalBody) modalBody.style.overflow = 'hidden';
        frame.style.display = 'block';
        frame.src = url;
    }

    modal.classList.add('active');
}

// 8. Auto-Detect File Size Logic
async function fetchFileSize(element) {
    // Jika sudah ada teks (dari CSV), jangan cek lagi
    if (element.innerText.trim() !== '') return;

    const url = element.dataset.url;
    if (!url) return;

    // Skip Google Drive links (karena biasanya diblokir CORS)
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) return;

    try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
            const size = response.headers.get('Content-Length');
            if (size) element.innerText = `(${formatBytes(size)})`;
        }
    } catch (e) { /* Ignore error */ }
}

function formatBytes(bytes, decimals = 0) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Helper Date Parser (Global)
function parseDateStr(d) {
    if (!d || typeof d !== 'string') return null;

    // Pisahkan Tanggal dan Jam (jika ada)
    // Contoh: "25-02-2026 09:00" -> dateStr="25-02-2026", timeStr="09:00"
    const [dateStr, timeStr] = d.trim().split(/\s+/);

    const cleanD = dateStr.replace(/\//g, '-');
    const parts = cleanD.split('-');
    if (parts.length !== 3) return null;

    let [p1, p2, p3] = parts.map(n => parseInt(n, 10));
    if (isNaN(p1) || isNaN(p2) || isNaN(p3)) return null;

    let dateObj;
    // Cek format YYYY-MM-DD (p1 > 31 asumsi tahun)
    if (p1 > 31) {
        dateObj = new Date(p1, p2 - 1, p3);
    } else {
        // Asumsi DD-MM-YYYY
        let year = p3;
        if (year < 100) year += 2000;
        dateObj = new Date(year, p2 - 1, p1);
    }

    // Handle Jam (Time)
    if (timeStr) {
        const [h, m] = timeStr.split(':').map(n => parseInt(n, 10));
        if (!isNaN(h)) dateObj.setHours(h);
        if (!isNaN(m)) dateObj.setMinutes(m);
        else dateObj.setMinutes(0);
    } else {
        // Default: Jika tidak ada jam, anggap deadline akhir hari (23:59:59)
        // Ini agar logika "Deadline Hari Ini" tetap valid sampai malam
        dateObj.setHours(23, 59, 59);
    }

    return dateObj;
}

// ==========================================
// 9. RANDOM GROUP GENERATOR (SPIN KELOMPOK)
// ==========================================
let isSpinning = false;
let forceStop = false; // Flag for click-to-stop
let spinSession = {
    active: false,
    remainingNames: [],
    groups: [],
    groupTurnOrder: [],
    roundRobinCounter: 0,
    currentDrawCount: 0,
    maxWinners: 0,
    numGroups: 1,
    mode: 'kelompok'
};

function initSpinUI() {
    const btnSpin = document.getElementById('btn-spin');
    const displayBox = document.getElementById('spin-names-container');
    const resultsContainer = document.getElementById('spin-results');
    const groupInput = document.getElementById('spin-groups');
    const spinDisplay = document.getElementById('spin-display');
    const textarea = document.getElementById('spin-names-textarea');
    const countDisplay = document.getElementById('spin-names-count');
    const fullscreenBtn = document.getElementById('btn-fullscreen-results');
    const shareBtn = document.getElementById('btn-share-results');
    const resultsWrapper = document.getElementById('spin-results-wrapper');
    const leftPanel = document.getElementById('spin-left-panel');
    const groupInputContainer = document.getElementById('spin-group-input-container');
    const winnerInputContainer = document.getElementById('spin-winner-input-container');
    const durationInput = document.getElementById('spin-duration-input');
    const modeRadios = document.querySelectorAll('input[name="spin-mode"]');

    // Mencegah multiple binding jika fungsi dipanggil ulang oleh router
    if (btnSpin.dataset.bound) return;
    btnSpin.dataset.bound = "true";

    // Handle Toggle Mode
    if (modeRadios.length > 0) {
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'urutan') {
                    if (groupInputContainer) groupInputContainer.style.display = 'none';
                    if (winnerInputContainer) winnerInputContainer.style.display = 'block';
                } else {
                    if (groupInputContainer) groupInputContainer.style.display = 'block';
                    if (winnerInputContainer) winnerInputContainer.style.display = 'none';
                }
            });
        });
    }

    // Add click-to-stop listener to the wheel display
    if (spinDisplay) {
        spinDisplay.addEventListener('click', () => {
            if (isSpinning) forceStop = true;
        });
    }

    // 1. Inisialisasi Textarea dengan data dari Google Sheets (Mahasiswa)
    const validStudents = mahasiswaData;
    let initialNames = [];

    if (validStudents.length > 0) {
        initialNames = validStudents.map(m => {
            const nameKey = Object.keys(m).find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('nama'));
            return nameKey ? m[nameKey].trim() : "Tanpa Nama";
        }).filter(n => n !== "Tanpa Nama" && n !== "");
    }

    if (textarea.value === '' && initialNames.length > 0) {
        textarea.value = initialNames.join('\n');
    }

    const canvas = document.getElementById('spin-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    let currentRotation = 0;

    function drawWheel(names, rotation) {
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(centerX, centerY) - 10;

        ctx.clearRect(0, 0, width, height);
        if (names.length === 0) return;

        // Palet warna harmonis yang cocok satu sama lain
        const palette = [
            '#e67e22', // orange
            '#2ecc71', // green
            '#3498db', // blue
            '#9b59b6', // purple
            '#e74c3c', // red
            '#1abc9c', // teal
            '#f39c12', // amber
            '#2980b9', // dark blue
            '#16a085', // dark teal
            '#8e44ad', // dark purple
        ];

        const sliceAngle = (2 * Math.PI) / names.length;

        for (let i = 0; i < names.length; i++) {
            const startAngle = rotation + i * sliceAngle;
            const endAngle = startAngle + sliceAngle;
            const color = palette[i % palette.length];

            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();

            ctx.fillStyle = color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.15)';
            ctx.stroke();

            // Text -- selalu putih agar terbaca di semua warna
            ctx.save();
            ctx.translate(centerX, centerY);
            // Putar ekstra 180 derajat (Math.PI) agar huruf dimulai dari pinggir luar
            ctx.rotate(startAngle + sliceAngle / 2 + Math.PI);
            ctx.textAlign = 'left'; // Rata kiri (mulai dari ujung luar yang sudah diputar)
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#ffffff';
            const nameLen = names[i].length;
            const fontSize = Math.max(16, Math.min(32, 36 - nameLen));
            ctx.font = 'bold ' + fontSize + 'px sans-serif';
            ctx.shadowColor = 'rgba(0,0,0,0.4)';
            ctx.shadowBlur = 3;
            const maxChars = Math.floor(radius / (fontSize * 0.55));
            const text = nameLen > maxChars ? names[i].substring(0, maxChars - 2) + '..' : names[i];
            ctx.fillText(text, -radius + 20, 0); // Posisi negatif karena sudah diputar balik 180 drajat
            ctx.restore();
        }

        // Draw center dot
        ctx.beginPath();
        ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
    }

    // Update counter saat mengetik
    const updateCount = () => {
        const lines = textarea.value.split('\n').filter(line => line.trim() !== '');
        countDisplay.innerText = `${lines.length} Orang`;
        drawWheel(lines, currentRotation);
    };

    textarea.addEventListener('input', () => {
        if (spinSession.active) {
            const resetBtn = document.getElementById('btn-reset-spin');
            if (resetBtn) resetBtn.click();
        }
        updateCount();
    });
    updateCount(); // Initial update

    const btnResetSpin = document.getElementById('btn-reset-spin');
    if (btnResetSpin) {
        btnResetSpin.addEventListener('click', () => {
            if (isSpinning) return;
            spinSession.active = false;

            textarea.disabled = false;
            btnResetSpin.style.display = 'none';
            btnSpin.innerHTML = 'Mulai Acak!';
            btnSpin.style.display = 'block';
            resultsContainer.innerHTML = '';

            if (resultsWrapper) resultsWrapper.style.display = 'none';
            if (fullscreenBtn) fullscreenBtn.style.display = 'none';
            if (shareBtn) shareBtn.style.display = 'none';

            currentRotation = 0;
            updateCount();
        });
    }

    // Fitur Fullscreen
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                if (resultsWrapper.requestFullscreen) {
                    resultsWrapper.requestFullscreen();
                } else if (resultsWrapper.webkitRequestFullscreen) { /* Safari */
                    resultsWrapper.webkitRequestFullscreen();
                } else if (resultsWrapper.msRequestFullscreen) { /* IE11 */
                    resultsWrapper.msRequestFullscreen();
                }
                fullscreenBtn.innerHTML = '<i class="ph ph-corners-in" style="font-size: 1.2rem;"></i>';
                resultsWrapper.classList.add('fullscreen-active');
                resultsWrapper.style.padding = '2rem';
                resultsWrapper.style.overflowY = 'auto'; // allow scrolling if needed
            } else {
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) { /* Safari */
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { /* IE11 */
                    document.msExitFullscreen();
                }
            }
        });

        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                fullscreenBtn.innerHTML = '<i class="ph ph-corners-out" style="font-size: 1.2rem;"></i>';
                resultsWrapper.classList.remove('fullscreen-active');
                resultsWrapper.style.padding = '0';
                resultsWrapper.style.overflowY = 'visible';
            }
        });
    }

    // Fitur Share WhatsApp
    if (shareBtn) {
        shareBtn.addEventListener('click', async () => {
            const cards = resultsContainer.querySelectorAll('.group-card');
            if (cards.length === 0) return;

            let text = "*HASIL PEMBAGIAN KELOMPOK*\n\n";
            cards.forEach(card => {
                // Ambil nama kelompok (misal: Kelompok 1) tanpa teks jumlah orang
                const headerText = card.querySelector('.group-card-header').innerText.split('\n')[0];
                const countText = card.querySelector('.group-card-count').innerText;

                text += `*${headerText}* (${countText})\n`;

                const items = card.querySelectorAll('li');
                items.forEach((item, index) => {
                    text += `${index + 1}. ${item.innerText}\n`;
                });
                text += "\n";
            });

            text += "_Dibuat dengan fagriella.github.io_";

            // Coba Share Native (Video + Teks) jika didukung browser HP
            if (recordedBlob && navigator.share) {
                try {
                    const ext = recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
                    const file = new File([recordedBlob], `undi-kelompok.${ext}`, { type: recordedBlob.type });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Hasil Undian',
                            text: text
                        });
                        return; // Jika berhasil share native, jangan buka wa.me
                    }
                } catch (e) { console.log("Share native gagal, fallback ke link WA", e); }
            }

            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        });
    }

    btnSpin.addEventListener('click', () => {
        if (isSpinning) return;

        // Ambil daftar nama langsung dari textarea
        const namesList = textarea.value.split('\n').map(n => n.trim()).filter(n => n !== '');

        if (namesList.length === 0) {
            alert("Daftar nama masih kosong. Silakan isi terlebih dahulu.");
            return;
        }

        const spinMode = document.querySelector('input[name="spin-mode"]:checked')?.value || 'kelompok';
        let numGroups = 1;
        let maxWinners = namesList.length;

        if (spinMode === 'kelompok') {
            numGroups = parseInt(groupInput.value, 10);
            if (isNaN(numGroups) || numGroups < 1) {
                alert("Masukkan jumlah kelompok yang valid.");
                return;
            }
            if (!spinSession.active) {
                if (numGroups > namesList.length) {
                    alert(`Jumlah kelompok (${numGroups}) tidak boleh melebihi jumlah mahasiswa (${namesList.length}).`);
                    return;
                }
                maxWinners = namesList.length;
            } else {
                maxWinners = spinSession.maxWinners + namesList.length;
            }
        } else {
            const winnerInput = document.getElementById('spin-winners');
            if (winnerInput) {
                const addWinners = parseInt(winnerInput.value, 10);
                if (isNaN(addWinners) || addWinners < 1) {
                    alert("Masukkan jumlah orang terpilih yang valid.");
                    return;
                }
                if (!spinSession.active) {
                    if (addWinners > namesList.length) {
                        alert(`Jumlah terpilih (${addWinners}) tidak boleh melebihi jumlah mahasiswa (${namesList.length}).`);
                        return;
                    }
                    maxWinners = addWinners;
                } else {
                    if (addWinners > spinSession.remainingNames.length) {
                        alert(`Sisa mahasiswa tinggal ${spinSession.remainingNames.length} orang.`);
                        return;
                    }
                    maxWinners = spinSession.currentDrawCount + addWinners;
                }
            }
        }

        // Inisialisasi State Session
        if (!spinSession.active) {
            spinSession.active = true;
            spinSession.remainingNames = shuffleArray([...namesList]);
            spinSession.mode = spinMode;
            spinSession.numGroups = spinMode === 'kelompok' ? numGroups : 1;
            spinSession.groups = Array.from({ length: spinSession.numGroups }, () => []);
            spinSession.groupTurnOrder = shuffleArray(Array.from({ length: spinSession.numGroups }, (_, i) => i));
            spinSession.roundRobinCounter = 0;
            spinSession.currentDrawCount = 0;

            textarea.disabled = true;
            resultsContainer.innerHTML = '';
            let initialHTML = '';
            for (let i = 0; i < spinSession.numGroups; i++) {
                const groupTitle = spinMode === 'urutan' ? 'Daftar Urutan Terpilih' : `Kelompok ${i + 1}`;
                initialHTML += `
                    <div class="group-card" id="group-card-${i}">
                        <h3 class="group-card-header">
                            ${groupTitle}
                            <span id="group-count-${i}" class="group-card-count">0 Orang</span>
                        </h3>
                        <ol id="group-list-${i}" class="group-card-list"></ol>
                    </div>
                `;
            }
            resultsContainer.innerHTML = initialHTML;
            if (typeof updateCount === 'function') updateCount();
        }
        spinSession.maxWinners = maxWinners;

        // 2. Mulai Animasi Pengacakan
        isSpinning = true;
        btnSpin.style.cursor = 'not-allowed';

        // Tampilkan area hasil dan tombol fullscreen segera
        if (resultsWrapper) resultsWrapper.style.display = 'block';
        if (fullscreenBtn) fullscreenBtn.style.display = 'block';

        // --- MULAI REKAM VIDEO ---
        recordedChunks = [];
        recordedBlob = null;
        const canvas = document.getElementById('spin-canvas');
        if (canvas && typeof canvas.captureStream === 'function') {
            try {
                const stream = canvas.captureStream(30); // 30 FPS
                const mimeTypes = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
                const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
                if (mimeType) {
                    mediaRecorder = new MediaRecorder(stream, { mimeType });
                    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
                    mediaRecorder.onstop = () => { recordedBlob = new Blob(recordedChunks, { type: mimeType }); };
                    mediaRecorder.start();
                }
            } catch (e) { console.error("Gagal merekam:", e); }
        }
        // -------------------------

        // Animasi memperbesar roda dan menyembunyikan panel lain
        const leftPanel = document.getElementById('spin-left-panel');
        const groupInputContainer = document.getElementById('spin-group-input-container');

        if (leftPanel) {
            leftPanel.style.opacity = '0';
            leftPanel.style.transform = 'scale(0.9)';
            setTimeout(() => leftPanel.style.display = 'none', 300);
        }

        // Sembunyikan mode pilihan juga
        const modeContainer = document.getElementById('spin-mode-container');
        if (modeContainer) {
            modeContainer.style.opacity = '0';
            setTimeout(() => modeContainer.style.display = 'none', 300);
        }

        if (groupInputContainer) {
            groupInputContainer.style.opacity = '0';
            setTimeout(() => groupInputContainer.style.display = 'none', 300);
        }

        const winnerInputContainer = document.getElementById('spin-winner-input-container');
        if (winnerInputContainer) {
            winnerInputContainer.style.opacity = '0';
            setTimeout(() => winnerInputContainer.style.display = 'none', 300);
        }
        btnSpin.style.opacity = '0';
        setTimeout(() => btnSpin.style.display = 'none', 300);

        const btnResetSpin = document.getElementById('btn-reset-spin');
        if (btnResetSpin) {
            btnResetSpin.style.opacity = '0';
            setTimeout(() => btnResetSpin.style.display = 'none', 300);
        }

        if (spinDisplay) {
            const size = window.innerWidth < 500 ? '280px' : '400px';
            spinDisplay.style.width = size;
            spinDisplay.style.height = size;
            spinDisplay.style.borderWidth = '8px';
        }

        // --- LOGIKA SESI STATE ---
        const remainingNames = spinSession.remainingNames;
        const groups = spinSession.groups;
        const groupTurnOrder = spinSession.groupTurnOrder;
        const numGroupLocales = spinSession.numGroups;
        const spinModeCheck = spinSession.mode;

        function spinSequentialRound() {
            if (remainingNames.length === 0 || spinSession.currentDrawCount >= spinSession.maxWinners) {
                isSpinning = false;

                // --- STOP REKAM VIDEO ---
                if (mediaRecorder && mediaRecorder.state === 'recording') {
                    mediaRecorder.stop();
                }

                if (spinDisplay) {
                    spinDisplay.style.width = '200px';
                    spinDisplay.style.height = '200px';
                    spinDisplay.style.borderWidth = '4px';
                }
                setTimeout(() => {
                    if (leftPanel) { leftPanel.style.display = 'block'; void leftPanel.offsetWidth; leftPanel.style.opacity = '1'; leftPanel.style.transform = 'scale(1)'; }

                    if (groupInputContainer && spinModeCheck !== 'urutan') {
                        groupInputContainer.style.display = 'block';
                        void groupInputContainer.offsetWidth;
                        groupInputContainer.style.opacity = '1';
                    }

                    if (winnerInputContainer && spinModeCheck === 'urutan') {
                        winnerInputContainer.style.display = 'block';
                        void winnerInputContainer.offsetWidth;
                        winnerInputContainer.style.opacity = '1';
                    }

                    btnSpin.style.display = 'block';
                    void btnSpin.offsetWidth;
                    btnSpin.style.opacity = '1';
                    btnSpin.style.cursor = 'pointer';
                    btnSpin.innerHTML = (remainingNames.length > 0) ? 'Lanjut Acak' : 'Selesai';

                    if (remainingNames.length === 0) {
                        btnSpin.style.display = 'none';
                    }

                    if (btnResetSpin) {
                        btnResetSpin.style.display = 'block';
                        void btnResetSpin.offsetWidth;
                        btnResetSpin.style.opacity = '1';
                    }

                    if (modeContainer) {
                        modeContainer.style.display = 'flex';
                        void modeContainer.offsetWidth;
                        modeContainer.style.opacity = '1';
                    }
                    if (shareBtn) shareBtn.style.display = 'block';
                }, 500);
                return;
            }

            // Cek Toggle Skip
            const skipToggle = document.getElementById('skip-animation-toggle');
            if (skipToggle && skipToggle.checked) {
                const winnerIndex = Math.floor(Math.random() * remainingNames.length);
                const winnerName = remainingNames[winnerIndex];

                // Hitung rotasi agar menunjuk ke pemenang
                const sliceAngle = (2 * Math.PI) / remainingNames.length;
                const pointerAngle = (3 * Math.PI) / 2; // 270 derajat (Atas)
                currentRotation = pointerAngle - ((winnerIndex + 0.10) * sliceAngle);

                // Gambar roda dengan posisi baru (sebelum nama dihapus)
                drawWheel(remainingNames, currentRotation);

                // Hapus nama dari daftar
                remainingNames.splice(winnerIndex, 1);

                if (spinSession.roundRobinCounter > 0 && spinSession.roundRobinCounter % numGroupLocales === 0) {
                    shuffleArray(groupTurnOrder);
                }

                let activeGroup = groupTurnOrder[spinSession.roundRobinCounter % numGroupLocales];
                groups[activeGroup].push(winnerName);

                const listEl = document.getElementById(`group-list-${activeGroup}`);
                const countEl = document.getElementById(`group-count-${activeGroup}`);
                if (listEl) {
                    if (spinModeCheck === 'urutan') {
                        const item = document.createElement('span');
                        item.innerText = `${spinSession.currentDrawCount + 1}. ${winnerName}`;
                        item.style.padding = '0.4rem 0.6rem';
                        item.style.fontSize = '0.95rem';
                        item.style.fontWeight = '500';
                        item.style.display = 'inline-block';

                        // Konfigurasi Grid bila belum ada
                        if (listEl.style.display !== 'grid') {
                            const totalItems = spinSession.maxWinners;
                            const cols = Math.min(totalItems, 5);
                            listEl.style.display = 'grid';
                            listEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
                            listEl.style.gap = '8px';
                            listEl.style.listStyle = 'none';
                            listEl.style.paddingLeft = '0';
                        }

                        listEl.appendChild(item);
                    } else {
                        listEl.innerHTML += `<li>${winnerName}</li>`;
                    }
                }
                if (countEl) countEl.innerText = `${groups[activeGroup].length} Orang`;

                if (countDisplay) countDisplay.innerText = `${remainingNames.length} Orang`;
                drawWheel(remainingNames, currentRotation);

                spinSession.currentDrawCount++;
                spinSession.roundRobinCounter++;
                setTimeout(spinSequentialRound, 500);
                return;
            }

            const targetSeconds = durationInput ? (parseFloat(durationInput.value) || 1) : 1;
            const fps = 60;
            const totalFrames = targetSeconds * fps;
            let baseSpeed = 2.0 / targetSeconds;
            baseSpeed = Math.max(0.05, Math.min(baseSpeed, 1.5));
            let spinSpeed = baseSpeed + (Math.random() * (baseSpeed * 0.2));
            const stopSpeed = 0.002;
            const friction = Math.exp(Math.log(stopSpeed / spinSpeed) / totalFrames);

            function animateSpin() {
                currentRotation += spinSpeed;
                drawWheel(remainingNames, currentRotation);
                spinSpeed *= friction;

                if (spinSpeed > 0.002 && !forceStop) {
                    requestAnimationFrame(animateSpin);
                } else {
                    forceStop = false; // Reset flag for the next round

                    let normalizedRotation = currentRotation % (2 * Math.PI);
                    if (normalizedRotation < 0) normalizedRotation += 2 * Math.PI;

                    let pointerAngle = (3 * Math.PI) / 2;
                    let adjustedAngle = pointerAngle - normalizedRotation;
                    if (adjustedAngle < 0) adjustedAngle += 2 * Math.PI;

                    const sliceAngle = (2 * Math.PI) / remainingNames.length;
                    let winnerIndex = Math.floor(adjustedAngle / sliceAngle);
                    if (winnerIndex >= remainingNames.length) winnerIndex = remainingNames.length - 1;
                    if (winnerIndex < 0) winnerIndex = 0;

                    const winnerName = remainingNames[winnerIndex];
                    remainingNames.splice(winnerIndex, 1);

                    // Re-shuffle urutan giliran setiap kali satu putaran penuh (setiap kelompok sudah dapat 1)
                    if (spinSession.roundRobinCounter > 0 && spinSession.roundRobinCounter % numGroupLocales === 0) {
                        shuffleArray(groupTurnOrder);
                    }

                    let activeGroup = groupTurnOrder[spinSession.roundRobinCounter % numGroupLocales];
                    groups[activeGroup].push(winnerName);

                    const listEl = document.getElementById(`group-list-${activeGroup}`);
                    const countEl = document.getElementById(`group-count-${activeGroup}`);
                    if (listEl) {
                        if (spinModeCheck === 'urutan') {
                            const item = document.createElement('span');
                            item.innerText = `${spinSession.currentDrawCount + 1}. ${winnerName}`;
                            item.style.padding = '0.4rem 0.6rem';
                            item.style.fontSize = '0.95rem';
                            item.style.fontWeight = '500';
                            item.style.display = 'inline-block';

                            if (listEl.style.display !== 'grid') {
                                listEl.style.display = 'grid';
                                listEl.style.gridTemplateColumns = 'repeat(5, 1fr)';
                                listEl.style.gap = '8px';
                                listEl.style.listStyle = 'none';
                                listEl.style.paddingLeft = '0';
                            }

                            listEl.appendChild(item);
                        } else {
                            listEl.innerHTML += `<li>${winnerName}</li>`;
                        }
                    }
                    if (countEl) countEl.innerText = `${groups[activeGroup].length} Orang`;

                    if (countDisplay) countDisplay.innerText = `${remainingNames.length} Orang`;
                    drawWheel(remainingNames, currentRotation);

                    spinSession.currentDrawCount++;
                    spinSession.roundRobinCounter++;
                    setTimeout(spinSequentialRound, 500);
                }
            }
            requestAnimationFrame(animateSpin);
        }
        spinSequentialRound();
    });
}

// Algoritma Fisher-Yates untuk mengacak array secara mutlak (O(n))
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

// Logika pembagian & rendering
function generateAndRenderGroups(names, numGroups, container) {
    const shuffledNames = shuffleArray([...names]);
    const groups = Array.from({ length: numGroups }, () => []);
    shuffledNames.forEach((name, index) => {
        const groupIndex = index % numGroups;
        groups[groupIndex].push(name);
    });
    const randomizedGroups = shuffleArray(groups);
    let htmlContent = '';
    randomizedGroups.forEach((groupMembers, i) => {
        const groupNumber = i + 1;
        htmlContent += `
            <div class="group-card">
                <h3 class="group-card-header">
                    Kelompok ${groupNumber}
                    <span class="group-card-count">${groupMembers.length} Orang</span>
                </h3>
                <ol class="group-card-list">
                    ${groupMembers.map(member => `<li>${member}</li>`).join('')}
                </ol>
            </div>
        `;
    });

    container.innerHTML = htmlContent;
}

// ================== DIY NOTIFIKASI HELPER ==================

/** Mencatat status langganan ke Google Sheets */
function logSubscriptionToGAS(status, subscription = null) {
    if (!SYNC_SCRIPT_URL || SYNC_SCRIPT_URL.includes('PASTE')) return;

    let url = `${SYNC_SCRIPT_URL}${SYNC_SCRIPT_URL.includes('?') ? '&' : '?'}action=subscribe&status=${status}&info=${encodeURIComponent(navigator.userAgent)}`;

    // (Subscription object tidak lagi dikirim karena menggunakan ntfy.sh)

    fetch(url, { mode: 'no-cors' }).catch(() => { });
}

/** Melakukan registrasi sederhana ntfy.sh */
async function subscribeToPush() {
    // Dengan ntfy.sh, kita cukup arahkan user ke URL topiknya saja
    window.open(NTFY_URL, '_blank');
    return "ntfy_subscribed";
}

// (urlBase64ToUint8Array dihapus karena tidak lagi butuh VAPID)

/** Menampilkan notifikasi lokal di browser */
function showLocalNotification(title, body) {
    if (!("Notification" in window) || Notification.permission !== 'granted') return;

    // Cek jika Service Worker aktif (lebih baik untuk notifikasi)
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: body,
                icon: 'images/logo/F.AGRIELLA.webp',
                badge: 'images/logo/F.AGRIELLA.webp',
                vibrate: [200, 100, 200],
                tag: 'task-update'
            });
        });
    } else {
        // Fallback ke Notification standard
        new Notification(title, { body: body, icon: 'images/logo/F.AGRIELLA.webp' });
    }
}

/** Loop pengecekan tugas baru (saat tab dibuka) */
function checkNewTasksLoop() {
    if (localStorage.getItem('consent_notifications') !== 'true') return;
    if (!SYNC_SCRIPT_URL || SYNC_SCRIPT_URL.includes('PASTE')) return;

    const url = `${SYNC_SCRIPT_URL}${SYNC_SCRIPT_URL.includes('?') ? '&' : '?'}action=get_latest`;

    fetch(url)
        .then(response => response.json())
        .then(res => {
            if (res.status === 'success' && res.data) {
                const latestTask = res.data;
                const lastSeenId = localStorage.getItem('last_seen_task_id');

                if (lastSeenId && parseInt(lastSeenId) < latestTask.id) {
                    showLocalNotification("Tugas Baru Terdeteksi!", `${latestTask.course}: ${latestTask.description}`);
                }
                localStorage.setItem('last_seen_task_id', latestTask.id);
            }
        })
        .catch(() => { });

    // Cek setiap 5 menit saat tab aktif
    setTimeout(checkNewTasksLoop, 5 * 60 * 1000);
}

// Jalankan loop saat awal
setTimeout(checkNewTasksLoop, 5000);