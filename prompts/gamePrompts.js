//STRATEGI PROMPT (LOGIKA SOAL)
const PROMPT_STRATEGIES = {
  // 1. Tarung Matematika
  math: (level, tema) => {
    let range, op, constraint;
    if (level === "mudah") {
      range = "1-20";
      op = "penjumlahan dan pengurangan";
      constraint = "hasil bilangan bulat positif 1-50";
    } else if (level === "sedang") {
      range = "10-100";
      op = "perkalian dan pembagian";
      constraint =
        "hasil bilangan bulat positif. UNTUK PEMBAGIAN: Pastikan habis dibagi (sisa 0).";
    } else {
      range = "50-500";
      op = "campuran (+, -, *, /)";
      constraint =
        "hasil bilangan bulat positif. UNTUK PEMBAGIAN: Pastikan habis dibagi (sisa 0).";
    }
    return `Bertindak sebagai Guru Matematika SD. Buat 30 soal hitungan (bukan cerita).
    Level: ${level}. Range: ${range}. Operasi: ${op}. Tema: ${tema}.
    Constraint: ${constraint}. Jangan ada soal duplikat.
    
    FORMAT RESPONSE WAJIB (JSON ARRAY):
    [{"soal":"10 + 10","jawaban":20}]
    
    ATURAN JSON:
    1. Field 'jawaban' HARUS tipe NUMBER (jangan pakai kutip).
    2. Keluarkan HANYA JSON mentah. Jangan pakai markdown \`\`\`.`;
  },

  // 2. Jejak nabi
  nabi: (level) => {
    let topik;
    if (level === "mudah") {
      topik = "Nabi Ulul Azmi, Mukjizat Terkenal, & Nama Nabi (25 Nabi)";
    } else if (level === "sedang") {
      topik = "Kisah Kaum (Ad, Tsamud, dll), Kitab Suci, & Peristiwa Penting";
    } else {
      topik =
        "Detail Silsilah Keluarga, Tempat Diutus, & Gelar Khusus (misal: Khalilullah)";
    }

    return `Bertindak sebagai Guru Sejarah Kebudayaan Islam (SKI). Buat 10 soal Pilihan Ganda tentang: ${topik}.
    Level: ${level}. Gunakan Bahasa Indonesia yang baku dan sumber yang sahih (Al-Qur'an/Hadits).
    
    FORMAT RESPONSE WAJIB (JSON ARRAY):
    [
      {
        "tanya": "Siapa nabi yang membelah lautan?",
        "opsi": ["Nabi Musa", "Nabi Isa", "Nabi Nuh", "Nabi Ibrahim"],
        "jawab": "Nabi Musa"
      }
    ]
    
    ATURAN KRUSIAL:
    1. Field 'jawab' HARUS SAMA PERSIS (copy-paste string) dengan salah satu string di dalam array 'opsi'. 
    2. JANGAN isi 'jawab' dengan huruf A/B/C/D. Isi dengan teks jawaban penuh.
    3. Pastikan tidak ada jawaban ganda/duplikat di dalam opsi.
    4. HANYA JSON mentah.`;
  },

  // 3. Sambung ayat
  ayat: (level) => {
    let scope, outputInstruction;
    let count = level === "mudah" ? 3 : 5;

    if (level === "mudah") {
      scope = "Surat Pendek (Ad-Dhuha s/d An-Nas)";

      outputInstruction = `
      FORMAT RESPONSE WAJIB (JSON ARRAY):
      [{
        "tanya": "(Potongan Ayat Arab)",
        "latin": "(Tuliskan CARA BACA / TRANSLITERASI dalam ejaan Indonesia. Contoh: 'Qul a'udzu birabbin nas'. JANGAN BERIKAN ARTINYA!)",
        "opsi": ["(Lanjutan A)", "(Lanjutan B)", "(Lanjutan C)", "(Lanjutan D)"],
        "jawab": "(Lanjutan Benar)"
      }]`;
    } else {
      // [PERBAIKAN DI SINI: MENAMBAHKAN FIELD LATIN UNTUK LEVEL SEDANG & SULIT]
      scope =
        level === "sedang"
          ? "Juz 30 Full (An-Naba s/d An-Nas)"
          : "Ayat Tengah Juz 30 (Acak)";
      
      outputInstruction = `
      FORMAT RESPONSE WAJIB (JSON ARRAY):
      [{
        "tanya": "(Potongan Ayat Arab)",
        "latin": "(Tuliskan CARA BACA / TRANSLITERASI dalam ejaan Indonesia. Contoh: 'Amma yatasaa alun'. JANGAN BERIKAN ARTINYA!)",
        "opsi": ["(Lanjutan A)", "(Lanjutan B)", "(Lanjutan C)", "(Lanjutan D)"],
        "jawab": "(Lanjutan Benar)"
      }]`;
    }

    return `Bertindak sebagai ahli Tahfidz. Buat ${count} soal sambung ayat. Lingkup: ${scope}.
    
    ${outputInstruction}
    
    ATURAN KRUSIAL:
    1. Teks Arab HARUS berharakat lengkap.
    2. JANGAN gunakan tanda kutip ganda (") di dalam teks Arab/Latin.
    3. Field 'latin' HARUS berupa cara baca (bunyi), BUKAN terjemahan bahasa Inggris/Indonesia.
    4. Field 'jawab' HARUS SAMA PERSIS (karakter per karakter) dengan salah satu string di 'opsi'.
    5. HANYA JSON mentah.`;
  },

  // 4. Kasir cilik
  kasir: (level) => {
    let range, note;
    if (level === "mudah") {
      range = "500-5000";
      note = "Kelipatan 500 (Uang Pas/Lebih dikit)";
    } else if (level === "sedang") {
      range = "10000-50000";
      note = "Ribuan acak. Uang bayar pecahan lazim (10rb, 20rb, 50rb).";
    } else {
      range = "50000-200000";
      note = "Angka keriting. Uang bayar pecahan lazim (50rb, 100rb).";
    }

    return `Simulasi Kasir. 15 transaksi. Level ${level}. Range Harga ${range}.
    
    FORMAT RESPONSE WAJIB (JSON ARRAY):
    [{"cerita":"Ibu membeli gula...","total_belanja":5000,"uang_bayar":10000,"kembalian":5000}]
    
    ATURAN:
    1. Pastikan 'uang_bayar' >= 'total_belanja'.
    2. Hitungan 'kembalian' HARUS MATEMATIS BENAR.
    3. Semua angka dalam format NUMBER (tanpa kutip).
    4. HANYA JSON mentah.`;
  },

  // 5. Lab memori
  memory: (level, tema) => {
    const pairs = level === "mudah" ? 6 : level === "sedang" ? 8 : 10;
    const context =
      tema === "bahasa"
        ? "Kata (A) dan Antonim/Sinonimnya (B)"
        : tema === "geografi"
        ? "Negara (A) dan Ibukotanya (B)"
        : "Objek (A) dan Pasangannya (B)";

    return `Buat ${pairs} pasang kartu unik untuk game memori. Tema: ${tema}. Konteks: ${context}.
    Kata-kata harus singkat (maksimal 2 kata).
    
    FORMAT RESPONSE WAJIB (JSON ARRAY):
    [{"a":"Hitam","b":"Putih"}, {"a":"Panas","b":"Dingin"}]
    
    ATURAN: HANYA JSON mentah.`;
  },

  // 6. Labirin Ilmu
  labirin: (level) => {
    let size = level === "mudah" ? 10 : level === "sedang" ? 15 : 20;
    let count = level === "mudah" ? 3 : level === "sedang" ? 5 : 7;
    let topic =
      level === "mudah"
        ? "Hewan/Buah"
        : level === "sedang"
        ? "Pengetahuan Umum SD"
        : "Geografi/Sains";

    return `Game Master Labirin. Grid ${size}x${size}. ${count} soal singkat tentang ${topic}.
    
    FORMAT RESPONSE WAJIB (JSON OBJECT):
    { "maze_size": ${size}, "soal_list": [{"tanya":"Ibukota Indonesia?","jawab":"Jakarta"}] }
    
    ATURAN:
    1. Jawaban 'jawab' HARUS 1 KATA SAJA (karena user mengetik manual).
    2. Jawaban tidak boleh case-sensitive (gunakan huruf umum).
    3. HANYA JSON mentah.`;
  },

  // 7. Tembak angka (zuma)
  zuma: (level, tema) => {
    let speed =
      level === "mudah" ? "lambat" : level === "sedang" ? "sedang" : "cepat";
    return `Konfigurasi Level Zuma. Tema ${tema}. Speed ${speed}.
    Output JSON Object MURNI (Tanpa Markdown): {"deskripsi":"Misi Galaksi...","palet_warna":["#F00","#0F0","#00F"],"speed":"${speed}"}`;
  },

  // 8. Matematika piano
  piano: (level) => {
    const len = level === "mudah" ? 3 : level === "sedang" ? 6 : 9;
    return `Urutan nada piano acak ${len} digit (angka 1-7).
    Output JSON Object MURNI (Tanpa Markdown): {"sequence":[1,3,5,2,4]}`;
  },

  // 9. AI tutor atau Guru Videa
  tutor: (soal, jawabUser, jawabBenar, kategori) => {
    let instruksiTajwid = "";
    if (
      kategori === "tajwid" &&
      (jawabBenar === "kiri" || jawabBenar === "kanan")
    ) {
      instruksiTajwid = `
        PERINGATAN: Data 'Jawaban Benar' di atas hanya kode posisi ('${jawabBenar}'). ABAIKAN ITU.
        TUGAS UTAMA: Analisis teks Arab pada 'Soal', tentukan sendiri hukum tajwidnya (misal: Al-Qamariyah, Ikhfa, dll).
        Gunakan hasil analisismu sebagai jawaban yang benar.`;
    }

    // A. Guru videa tajwid
    if (kategori === "tajwid") {
      return `SYSTEM OVERRIDE: STOP OUTPUT JSON. SWITCH TO PLAIN TEXT HTML MODE.
          
          Kamu adalah Guru Ngaji SD yang ceria dan pintar.
          Siswa salah menjawab kuis Tajwid.
          
          DATA:
          - Soal (Teks Arab): "${soal}"
          - Jawaban Siswa: "${jawabUser}" (Salah)
          - Jawaban Benar (Info Server): "${jawabBenar}"

          ${instruksiTajwid}

          INSTRUKSI OUTPUT (WAJIB HTML):
          1. JANGAN buat JSON. Buat teks biasa.
          2. Gunakan tag <br> untuk ganti baris (jangan pakai Enter biasa).
          3. Gunakan tag <b>...</b> untuk menebalkan kata kunci.
          
          CONTOH FORMAT BALASAN:
          "Yah, masih kurang tepat! 😅<br><br>
          Hukum yang benar adalah <b>[Sebutkan Nama Hukum Tajwidnya]</b>.<br><br>
          👉 <b>Alasannya:</b> Karena terdapat [Huruf A] bertemu [Huruf B] dan dibaca [Jelas/Dengung/Samar].<br>
          Yuk coba lagi!"`;
    }

    // B. guru videa labirin ilmu
    else if (kategori === "labirin") {
      return `SYSTEM OVERRIDE: PLAIN TEXT HTML MODE.
      
          Konteks: Siswa SD salah jawab soal pengetahuan umum.
          Soal: "${soal}"
          Jawaban Benar: "${jawabBenar}"
          
          TUGASMU:
          1. Cari satu fakta unik atau "jembatan keledai" (cara hafal) singkat tentang "${jawabBenar}".
          2. Masukkan fakta itu ke dalam format HTML di bawah ini.
          
          FORMAT OUTPUT (Ganti tulisan [ISI_DISINI] dengan fakta yang kamu temukan):
          "Ups, belum tepat! 🤔<br><br>
          Jawabannya adalah <b>${jawabBenar}</b>.<br><br>
          💡 <b>Ingat ya:</b> [ISI_DISINI]"`;
    }

    // C. PROMPT UMUM (Nabi, Ayat, dll)
    //nabi
    else if (kategori === "nabi") {
      return `SYSTEM OVERRIDE: ABSOLUTELY NO JSON. JUST WRITE TEXT.

      Soal: "${soal}"
      Jawaban Benar: "${jawabBenar}"

      TUGAS:
      Tulis langsung kalimat di bawah ini tanpa pembungkus apapun.
      
      ATURAN KERAS:
      1. JANGAN pakai tanda kurung kurawal { atau }.
      2. JANGAN pakai tanda kutip " di awal kalimat.
      3. JANGAN pakai markdown \`\`\`.
      4. Gunakan tag <br> dan <b> sesuai template.

      TEMPLATE (Tulis Persis Ini):
      Tetap semangat! 💪<br>
      Jawabannya: <b>${jawabBenar}</b>.<br>
      💡 <b>Info:</b> [Isi Alasan Singkat Max 10 Kata Disini]`;
    } else {
      // KHUSUS GAME AYAT
      return `SYSTEM OVERRIDE: STOP OUTPUT JSON. SWITCH TO PLAIN TEXT HTML MODE.
      
          Peran: Kamu adalah Guru Ngaji SD yang ramah. 
          Konteks: Siswa sedang bermain 'Sambung Ayat' dan salah menebak.
          Soal: "${soal}" 
          Jawaban Benar: "${jawabBenar}"
          
          TUGASMU (Jawab dalam format HTML string):
          1. Ucapkan penyemangat pendek: "Jangan menyerah! 💪" atau "Sedikit lagi!"
          2. Beritahu jawaban yang benar: "Lanjutan/Jawaban yang tepat adalah <b>${jawabBenar}</b>."
          3. Berikan INFO HAFALAN singkat (maksimal 1 kalimat).
             Pilih salah satu fokus:
             - Sebutkan Nama Surat & Ayat ke berapa.
             - Atau sebutkan Arti/Terjemahan potongan ayat tersebut.
             
             (Contoh yang BENAR: "Ini adalah ayat ke-2 dari Surat Al-Falaq." atau "Ayat ini artinya: Raja Manusia.")
             (JANGAN jelaskan tajwid seperti idgham/ikhfa).
          
          Gunakan tag <br> untuk ganti baris. JANGAN output JSON.`;
    }
  },

  // 10. Pilah hukum
  tajwid: (level) => {
    let pair;

    // Logika Tingkat Kesulitan
    if (level === "mudah") {
      // Paling Dasar: Huruf Syamsiah vs Qamariyah
      pair = { a: "Al-Qamariyah (Jelas)", b: "Al-Syamsiyah (Lebur)" };
    } else if (level === "sedang") {
      // Hukum Nun Mati: Jelas vs Samar
      pair = { a: "Izhar (Jelas)", b: "Ikhfa (Samar)" };
    } else {
      const hardPairs = [
        { a: "Qalqalah Sugra (Tengah)", b: "Qalqalah Kubra (Akhir)" },
        {
          a: "Idgham Bighunnah (Dengung)",
          b: "Idgham Bilaghunnah (Tanpa Dengung)",
        },
      ];
      pair = hardPairs[Math.floor(Math.random() * hardPairs.length)];
    }

    return `Bertindak sebagai Guru Tajwid SD. Saya butuh contoh kata pendek untuk hukum: "${pair.a}" dan "${pair.b}".
    
    Tugas:
    Berikan total 15 kata Arab pendek (maksimal 2 kata) yang mengandung hukum tersebut.
    
    FORMAT RESPONSE WAJIB (JSON OBJECT):
    {
      "kategori_kiri": "${pair.a}",
      "kategori_kanan": "${pair.b}",
      "data": [
        {"teks": "الْحَمْدُ", "hukum": "kiri"}, 
        {"teks": "الرَّحْمَنِ", "hukum": "kanan"}
      ]
    }
    
    ATURAN KRUSIAL:
    1. Teks Arab HARUS berharakat lengkap.
    2. Pastikan contohnya JELAS (tidak ambigu).
    3. HANYA JSON MENTAH.`;
  },
};

module.exports = PROMPT_STRATEGIES;
