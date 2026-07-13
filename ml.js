let currentMenu = "kecamatan";
let currentView = "chart";
let myChart = null;
let activeData = null;

let globalKecData = null;
let globalPplData = null;
let globalPmlData = null;

let globalPsgKecProgress = null;
let selectedPml = "Semua";
let globalPsgPplPml = [];

function updateDashboardData(whatData) {
  let data = whatData;

  // JIKA menu saat ini adalah PPL dan filter yang dipilih BUKAN "Semua"
  if (currentMenu === "ppl" && selectedPml !== "Semua" && data) {
    // Cari indeks mana saja yang memiliki PML sesuai pilihan
    const indeksCocok = [];
    globalPsgPplPml.forEach((item, index) => {
      if (item.pml === selectedPml) {
        indeksCocok.push(index);
      }
    });

    // Saring array data utama terlebih dahulu
    const filteredOpen = whatData.open.filter((_, idx) =>
      indeksCocok.includes(idx),
    );
    const filteredTarget = whatData.target.filter((_, idx) =>
      indeksCocok.includes(idx),
    );
    const filteredRealisasi = whatData.realisasi.filter((_, idx) =>
      indeksCocok.includes(idx),
    );

    // Hitung akumulasi total untuk data yang disaring
    const totalTarget = filteredTarget.reduce(
      (a, b) => Number(a) + Number(b),
      0,
    );
    const totalOpen = filteredOpen.reduce((a, b) => Number(a) + Number(b), 0);
    const totalRealisasi = filteredRealisasi.reduce(
      (a, b) => Number(a) + Number(b),
      0,
    );

    // Hitung persentase progress sesuai rumus: (realisasi / target) * 100
    let progressPmlText = "0,00%";
    // Pastikan data global PML sudah terisi (User sudah pernah klik menu PML atau data sudah ter-load)
    if (globalPmlData && globalPmlData.labels) {
      // Cari indeks di mana nama PML terpilih berada di dalam array data PML
      const pmlIdx = globalPmlData.labels.findIndex(
        (nama) => nama.toLowerCase() === selectedPml.toLowerCase(),
      );

      // Jika ketemu, ambil nilai progress dari array data PML asli (misal: data.progress[pmlIdx])
      // Catatan: Sesuaikan 'globalPmlData.progress' di bawah dengan nama properti array progress di handler PML-mu
      if (
        pmlIdx !== -1 &&
        globalPmlData.progress &&
        globalPmlData.progress[pmlIdx]
      ) {
        const nilaiProgressRaw = globalPmlData.progress[pmlIdx];

        // Format ke "46,28%" (jika data dari Sheets masih berupa angka mentah 46.28)
        progressPmlText =
          typeof nilaiProgressRaw === "number"
            ? nilaiProgressRaw.toFixed(2).replace(".", ",") + "%"
            : nilaiProgressRaw; // Jika dari Sheets sudah berbentuk teks "46,28%"
      }
    }

    // Fallback cadangan: Jika data PML global belum siap/belum di-load, gunakan hitungan lokal
    if (progressPmlText === "0,00%" && totalTarget > 0) {
      const hitungProgress = (totalRealisasi / totalTarget) * 100;
      progressPmlText = hitungProgress.toFixed(2).replace(".", ",") + "%";
    }

    // Buat objek baru khusus untuk menampung data yang lolos filter
    data = {
      ...whatData,
      stats: {
        target: totalTarget.toLocaleString("id-ID"),
        open: totalOpen.toLocaleString("id-ID"),
        realisasi: totalRealisasi.toLocaleString("id-ID"),
        persen: progressPmlText,
      },
      labels: whatData.labels.filter((_, idx) => indeksCocok.includes(idx)),
      open: whatData.open.filter((_, idx) => indeksCocok.includes(idx)),
      draft: whatData.draft.filter((_, idx) => indeksCocok.includes(idx)),
      submit: whatData.submit.filter((_, idx) => indeksCocok.includes(idx)),
      approved: whatData.approved.filter((_, idx) => indeksCocok.includes(idx)),
      rejected: whatData.rejected.filter((_, idx) => indeksCocok.includes(idx)),
      target: whatData.target.filter((_, idx) => indeksCocok.includes(idx)),
      realisasi: whatData.realisasi.filter((_, idx) =>
        indeksCocok.includes(idx),
      ),
      progress: whatData.progress.filter((_, idx) => indeksCocok.includes(idx)),
      tambah_submit: whatData.tambah_submit
        ? whatData.tambah_submit.filter((_, idx) => indeksCocok.includes(idx))
        : [],
    };
  } else if (currentMenu === "ppl" && selectedPml === "Semua" && data) {
    let globalProgressText = "0,00%";
    if (
      typeof globalPsgKecProgress !== "undefined" &&
      globalPsgKecProgress.kilo
    ) {
      globalProgressText =
        globalPsgKecProgress.kilo.toFixed(2).replace(".", ",") + "%";
    } else if (data.stats && data.stats.persen) {
      globalProgressText = data.stats.persen;
    }

    data = {
      ...whatData,
      stats: {
        ...whatData.stats,
        persen: globalProgressText,
      },
    };
  }

  // Cek keamanan jika data kosong agar tidak crash
  if (!data) return;

  document.getElementById("main-title").innerText = data.title;
  document.getElementById("th-name").innerText = data.thName;

  document.getElementById("stat-target").innerText = data.stats.target;
  document.getElementById("stat-blm-terdata").innerText = data.stats.open;
  document.getElementById("stat-realisasi").innerText = data.stats.realisasi;
  document.getElementById("stat-persen").innerText = data.stats.persen;

  if (currentView === "chart") {
    renderChart(data);
  } else {
    renderTable(data);
  }
}

function renderTable(whatData) {
  const dataContent = whatData;
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  if (!dataContent) {
    if (currentMenu === "kecamatan") {
      dataContent = globalKecData;
    } else if (currentMenu === "ppl") {
      dataContent = globalPplData;
    } else {
      dataContent = globalPmlData;
    }
  }

  // 2. Validasi agar aman dari crash jika data belum siap
  if (!dataContent || !dataContent.labels) {
    console.warn("Data belum siap untuk dirender ke tabel.");
    return;
  }
  dataContent.labels.forEach((label, index) => {
    const tgt = dataContent.target[index];
    const real = dataContent.realisasi[index];
    const percentage = dataContent.progress[index];
    const open = dataContent.open[index];
    const submit = dataContent.submit[index];
    const draft = dataContent.draft[index];
    const approved = dataContent.approved[index];
    const rejected = dataContent.rejected[index];

    const row = document.createElement("tr");
    row.className = "theme-transition border-b border-slate-100";
    row.innerHTML = `
            <td class="py-4 px-4 font-medium text-slate-950 sticky left-0 bg-white dark:bg-slate-800 z-10">${label}</td>
            <td class="py-4 px-4">
                <div class="flex items-center space-x-3 justify-end">
                    <span class="font-semibold text-xs w-10 text-right text-amber-600 dark:text-amber-400">${percentage.toLocaleString("id-ID")}%</span>
                    <div class="w-24 bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden hidden sm:block">
                        <div class="bg-amber-500 h-full rounded-full" style="width: ${percentage}%"></div>
                    </div>
                </div>
            </td>
            <td class="py-4 px-4 text-right">${tgt.toLocaleString("id-ID")}</td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-green-600">${real.toLocaleString("id-ID")}</span></td>
            <td class="py-4 px-4 text-right">${open.toLocaleString("id-ID")}</td>
            <td class="py-4 px-4 text-right">${submit.toLocaleString("id-ID")}</td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-yellow-500">${draft.toLocaleString("id-ID")}</span></td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-blue-500">${approved.toLocaleString("id-ID")}</span></td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-red-500">${rejected.toLocaleString("id-ID")}</span></td>
        `;
    tbody.appendChild(row);
  });
}

function renderChart(whatData) {
  if (myChart) {
    myChart.destroy();
  }

  const dataContent = whatData || activeData;
  const isDark = document.documentElement.classList.contains("dark");
  const textColor = isDark ? "#cbd5e1" : "#64748b";
  if (!dataContent || !dataContent.progress) return;
  const percentages = dataContent.progress.map((pct) =>
    parseFloat(pct.toFixed(2)),
  );

  const ctx = document.getElementById("progressChart").getContext("2d");
  myChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: dataContent.labels,
      datasets: [
        {
          label: "Progress Capaian",
          data: percentages,
          backgroundColor: "#f59e0b",
          borderRadius: 6,
          categoryPercentage: 0.8,
          barPercentage: 0.9,
        },
      ],
    },
    plugins: [ChartDataLabels],
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "start",
          offset: 3,
          color: "#000000",
          font: {
            weight: "bold",
            size: 15,
            family: "monospace",
          },
          // Format tampilan agar ditambahkan simbol '%'
          formatter: (value) => value.toLocaleString("id-ID") + "%",
        },
        tooltip: {
          backgroundColor: isDark ? "#1e293b" : "#0f172a",
          titleColor: "#ffffff",
          bodyColor: "#e2e8f0",
          borderColor: isDark ? "#475569" : "#334155",
          borderWidth: 1,
          callbacks: {
            label: function (context) {
              const idx = context.dataIndex;
              const tgt = dataContent.target[idx].toLocaleString("id-ID");
              const open = dataContent.open[idx];
              const real = dataContent.realisasi[idx].toLocaleString("id-ID");
              const pct = context.parsed.x;

              if (currentMenu === "ppl") {
                // 1. Ambil kecocokan PML seperti yang sudah berhasil sebelumnya
                const pmlMatch = globalPsgPplPml.find(
                  (item) =>
                    item.ppl.toLowerCase() === context.label.toLowerCase(),
                );
                const namaPml = pmlMatch ? pmlMatch.pml : "-";

                // 2. KUNCI TAMBAHAN: Tarik nilai 'Tambah Submit' berdasarkan baris dataContent saat ini
                // Menggunakan dataContent menjamin datanya sinkron dengan grafik yang sedang tampil
                const tambahSubmitNilai =
                  dataContent.tambah_submit && dataContent.tambah_submit[idx]
                    ? dataContent.tambah_submit[idx].toLocaleString("id-ID")
                    : "0";

                return [
                  `PML: ${namaPml}`,
                  `Progress: ${pct.toLocaleString("id-ID")}%`,
                  `Sudah Didata: ${real}`,
                  `Belum Didata: ${open}`,
                  `Target: ${tgt}`,
                  `Tambah Submit: ${tambahSubmitNilai}`, // Gunakan variabel hasil sinkronisasi ini
                ];
              } else if (currentMenu === "pml") {
                const verif = dataContent.verifikasi[idx] || 0;
                return [
                  `Progress: ${pct.toLocaleString("id-ID")}%`,
                  `Terverifikasi: ${verif.toLocaleString("id-ID")}%`,
                  `Sudah Didata: ${real}`,
                  `Belum Didata: ${open}`,
                  `Target: ${tgt}`,
                ];
              } else {
                return [
                  `Progress: ${pct.toLocaleString("id-ID")}%`,
                  `Sudah Didata: ${real}`,
                  `Belum Didata: ${open}`,
                  `Target: ${tgt}`,
                ];
              }
            },
          },
        },
      },
      scales: {
        x: {
          max: 100,
          grid: { display: false },
          ticks: {
            color: textColor,
            callback: function (value) {
              return value + "%";
            },
          },
        },
        y: {
          grid: { display: false },
          ticks: { color: textColor },
        },
      },
    },
  });
}

function kapitalTiapKata(huruf) {
  if (typeof huruf !== "string") return huruf;

  return huruf.toLowerCase().replace(/\b\w/g, function (karakter) {
    return karakter.toUpperCase();
  });
}

const dataKecHandler = (data) => {
  const nmKec = data.map((e) => kapitalTiapKata(e.kec.replace("'", "")));
  const blm_didata = data.map((e) => e.open).reduce((a, b) => a + b);
  const targetPerKec = data.map((e) => e.target);
  const realisasiPerKec = data.map((e) => e.submit + e.approved + e.rejected);
  const persenPerKec = data.map((e) => e.progress);

  const psgKecProgress = Object.fromEntries(
    nmKec.map((nama, indeks) => [nama.toLowerCase(), persenPerKec[indeks]]),
  );
  globalPsgKecProgress = psgKecProgress;

  const terdata =
    data.map((e) => e.submit).reduce((a, b) => a + b) +
    data.map((e) => e.approved).reduce((a, b) => a + b) +
    data.map((e) => e.rejected).reduce((a, b) => a + b);

  const kecData = {
    title: "Progress Capaian per Kecamatan",
    thName: "Kecamatan",
    stats: {
      open: blm_didata.toLocaleString("id-ID"),
      target: targetPerKec.reduce((a, b) => a + b).toLocaleString("id-ID"),
      realisasi: terdata.toLocaleString("id-ID"),
      persen:
        ((terdata / data.map((e) => e.target).reduce((a, b) => a + b)) * 100)
          .toFixed(2)
          .replace(".", ",") + "%",
    },
    labels: nmKec,
    open: data.map((e) => e.open.toLocaleString("id-ID")),
    draft: data.map((e) => e.draft.toLocaleString("id-ID")),
    submit: data.map((e) => e.submit.toLocaleString("id-ID")),
    approved: data.map((e) => e.approved.toLocaleString("id-ID")),
    rejected: data.map((e) => e.rejected.toLocaleString("id-ID")),
    target: targetPerKec,
    realisasi: realisasiPerKec,
    progress: persenPerKec,
  };

  globalKecData = kecData;
  activeData = kecData;

  if (currentMenu === "kecamatan") {
    updateDashboardData(kecData);
  }
};

const dataPPLHandler = (data) => {
  const nmPPL = data.map((e) => e.ppl);
  const nmPML = [...new Set(data.map((e) => e.pml))];
  const blm_didata = data.map((e) => e.open).reduce((a, b) => a + b);
  const targetPerPPL = data.map((e) => e.target);
  const realisasiPerPPL = data.map((e) => e.submit + e.approved + e.rejected);
  const persenPerPPL = data.map((e) => e.progress);
  const tambahSubmit = data.map((e) => e.tambah_submit || 0); // Default ke 0 jika undefined

  globalPsgPplPml = data.map((e) => ({
    ppl: e.ppl,
    pml: e.pml,
  }));

  const dropdown = document.getElementById("filter-pml");
  if (dropdown) {
    // Reset isi dropdown, tambahkan opsi "Semua" di paling atas
    dropdown.innerHTML = `<option value="Semua">Semua PML</option>`;

    // Masukkan nama-nama PML dari array nmPML
    nmPML.forEach((pml) => {
      dropdown.innerHTML += `<option value="${pml}">${pml}</option>`;
    });

    // Event listener saat user mengubah filter dropdown
    dropdown.onchange = (event) => {
      selectedPml = event.target.value;
      // Picu render ulang dashboard menggunakan data global PPL yang sudah disaring
      updateDashboardData(globalPplData);
    };
  }

  const terdata =
    data.map((e) => e.submit).reduce((a, b) => a + b) +
    data.map((e) => e.approved).reduce((a, b) => a + b) +
    data.map((e) => e.rejected).reduce((a, b) => a + b);

  const pplData = {
    title: "Progress Capaian per PPL Kecamatan Kilo",
    thName: "PPL",
    stats: {
      open: blm_didata.toLocaleString("id-ID"),
      target: targetPerPPL.reduce((a, b) => a + b).toLocaleString("id-ID"),
      realisasi: terdata.toLocaleString("id-ID"),
      persen: globalPsgKecProgress.kilo.toFixed(2).replace(".", ",") + "%",
    },
    labels: nmPPL,
    open: data.map((e) => e.open.toLocaleString("id-ID")),
    draft: data.map((e) => e.draft.toLocaleString("id-ID")),
    submit: data.map((e) => e.submit.toLocaleString("id-ID")),
    approved: data.map((e) => e.approved.toLocaleString("id-ID")),
    rejected: data.map((e) => e.rejected.toLocaleString("id-ID")),
    target: targetPerPPL,
    realisasi: realisasiPerPPL,
    progress: persenPerPPL,
    tambah_submit: tambahSubmit,
  };

  globalPplData = pplData;
  activeData = pplData;

  if (currentMenu === "ppl") {
    updateDashboardData(pplData);
  }
};

dataPMLHandler = (data) => {
  const nmPML = [...new Set(data.map((e) => e.pml))];
  const blm_didata = data.map((e) => e.open).reduce((a, b) => a + b);
  const targetPerPML = data.map((e) => e.target);
  const realisasiPerPML = data.map((e) => e.submit + e.approved + e.rejected);
  const persenPerPML = data.map((e) => e.progress);
  const verif = data.map((e) => e.terverifikasi || 0);

  const terdata =
    data.map((e) => e.submit).reduce((a, b) => a + b) +
    data.map((e) => e.approved).reduce((a, b) => a + b) +
    data.map((e) => e.rejected).reduce((a, b) => a + b);

  const pmlData = {
    title: "Progress Capaian per PML Kecamatan Kilo",
    thName: "PML",
    stats: {
      open: blm_didata.toLocaleString("id-ID"),
      target: targetPerPML.reduce((a, b) => a + b).toLocaleString("id-ID"),
      realisasi: terdata.toLocaleString("id-ID"),
      persen: globalPsgKecProgress.kilo.toFixed(2).replace(".", ",") + "%",
    },
    labels: nmPML,
    open: data.map((e) => e.open.toLocaleString("id-ID")),
    draft: data.map((e) => e.draft.toLocaleString("id-ID")),
    submit: data.map((e) => e.submit.toLocaleString("id-ID")),
    approved: data.map((e) => e.approved.toLocaleString("id-ID")),
    rejected: data.map((e) => e.rejected.toLocaleString("id-ID")),
    target: targetPerPML,
    realisasi: realisasiPerPML,
    progress: persenPerPML,
    verifikasi: verif,
  };

  globalPmlData = pmlData;
  activeData = pmlData;
  updateDashboardData(pmlData);
};

// CHAINING CALLBACKS: Ambil data kecamatan dulu, baru data PPL dan PML
getSheetData({
  query: "SELECT *",
  sheet: "Data Kecamatan",
  callback: (kecDataRaw) => {
    dataKecHandler(kecDataRaw);
    getSheetData({
      query: "SELECT *",
      sheet: "PPL",
      callback: dataPPLHandler,
    });
  },
});

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const isHidden = sidebar.classList.contains("-translate-x-full");

  if (isHidden) {
    sidebar.classList.remove("-translate-x-full");
    backdrop.classList.remove("opacity-0", "pointer-events-none");
    backdrop.classList.add("opacity-100");
  } else {
    sidebar.classList.add("-translate-x-full");
    backdrop.classList.remove("opacity-100");
    backdrop.classList.add("opacity-0", "pointer-events-none");
  }
}

function applyTheme(theme) {
  const htmlEl = document.documentElement;
  const icons = document.querySelectorAll(
    ".mobile-theme-icon, .desktop-theme-icon",
  );
  const toggleContainer = document.getElementById("toggle-view-container");
  const btnChart = document.getElementById("view-btn-chart");
  const btnTable = document.getElementById("view-btn-table");

  if (theme === "dark") {
    htmlEl.classList.add("dark");
    icons.forEach(
      (icon) =>
        (icon.className = icon.classList.contains("mobile-theme-icon")
          ? "mobile-theme-icon fa-solid fa-sun"
          : "desktop-theme-icon fa-solid fa-sun"),
    );

    if (toggleContainer) toggleContainer.style.backgroundColor = "#1e293b";

    // Menyesuaikan warna font tombol secara presisi di darkmode
    if (currentView === "chart" && btnChart) {
      btnChart.style.backgroundColor = "#334155";
      btnChart.style.color = "#ffffff";
    }
    if (currentView === "table" && btnTable) {
      btnTable.style.backgroundColor = "#334155";
      btnTable.style.color = "#ffffff";
    }
  } else {
    htmlEl.classList.remove("dark");
    icons.forEach(
      (icon) =>
        (icon.className = icon.classList.contains("mobile-theme-icon")
          ? "mobile-theme-icon fa-solid fa-moon"
          : "desktop-theme-icon fa-solid fa-moon"),
    );

    if (toggleContainer) toggleContainer.style.backgroundColor = "#e2e8f0";

    if (currentView === "chart" && btnChart) {
      btnChart.style.backgroundColor = "#ffffff";
      btnChart.style.color = "#0f172a";
    }
    if (currentView === "table" && btnTable) {
      btnTable.style.backgroundColor = "#ffffff";
      btnTable.style.color = "#0f172a";
    }
  }
  if (currentView === "chart") renderChart();
}

function toggleTheme() {
  if (document.documentElement.classList.contains("dark")) {
    localStorage.setItem("theme", "light");
    applyTheme("light");
  } else {
    localStorage.setItem("theme", "dark");
    applyTheme("dark");
  }
}

// PENGATURAN 1: Jadikan Darkmode Sebagai Default Utama Halaman
if (!localStorage.getItem("theme")) {
  localStorage.setItem("theme", "dark");
}

// Jalankan tema bawaan sesuai localStorage
if (localStorage.getItem("theme") === "dark") {
  applyTheme("dark");
} else {
  applyTheme("light");
}

function switchMenu(menu) {
  const filterContainer = document.getElementById("pml-filter-container");

  ["kecamatan", "ppl", "pml"].forEach((m) => {
    const btn = document.getElementById(`menu-${m}`);
    btn.className =
      "theme-transition w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-left text-slate-600 hover:bg-slate-100/70 cursor-pointer";
    btn.style.backgroundColor = "";
    btn.style.color = "";
  });

  const activeBtn = document.getElementById(`menu-${menu}`);
  activeBtn.className =
    "theme-transition w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium text-left bg-amber-500 text-white shadow-xs";

  currentMenu = menu;
  if (menu === "kecamatan") {
    filterContainer.classList.add("hidden");
    activeData = globalKecData;
  } else if (menu === "ppl") {
    filterContainer.classList.remove("hidden");
    activeData = globalPplData;
  } else {
    filterContainer.classList.add("hidden");
    if (globalPmlData) {
      activeData = globalPmlData;
      updateDashboardData(activeData);
    } else {
      getSheetData({
        query: "SELECT *",
        sheet: "PML",
        callback: dataPMLHandler,
      });
    }
  }
  if (window.innerWidth < 768) toggleSidebar();
  if (activeData) {
    updateDashboardData(activeData);
  }
}

function switchView(view) {
  currentView = view;

  if (!activeData) return;

  const btnChart = document.getElementById("view-btn-chart");
  const btnTable = document.getElementById("view-btn-table");
  const wrapperChart = document.getElementById("wrapper-chart");
  const wrapperTable = document.getElementById("wrapper-table");
  const isDark = document.documentElement.classList.contains("dark");

  let dataKunci = globalKecData;
  if (currentMenu === "ppl") {
    dataKunci = globalPplData;
  } else if (currentMenu === "pml") {
    dataKunci = globalPmlData;
  }

  // Terapkan filter PML yang sama jika user sedang di menu PPL
  if (currentMenu === "ppl" && selectedPml !== "Semua" && dataKunci) {
    const indeksCocok = [];
    globalPsgPplPml.forEach((item, index) => {
      if (item.pml === selectedPml) {
        indeksCocok.push(index);
      }
    });

    // Potong data mentah agar hanya berisi PPL dari PML yang dipilih
    dataKunci = {
      ...dataKunci,
      labels: dataKunci.labels.filter((_, idx) => indeksCocok.includes(idx)),
      open: dataKunci.open.filter((_, idx) => indeksCocok.includes(idx)),
      draft: dataKunci.draft.filter((_, idx) => indeksCocok.includes(idx)),
      submit: dataKunci.submit.filter((_, idx) => indeksCocok.includes(idx)),
      approved: dataKunci.approved.filter((_, idx) =>
        indeksCocok.includes(idx),
      ),
      rejected: dataKunci.rejected.filter((_, idx) =>
        indeksCocok.includes(idx),
      ),
      target: dataKunci.target.filter((_, idx) => indeksCocok.includes(idx)),
      realisasi: dataKunci.realisasi.filter((_, idx) =>
        indeksCocok.includes(idx),
      ),
      progress: dataKunci.progress.filter((_, idx) =>
        indeksCocok.includes(idx),
      ),
      tambah_submit: dataKunci.tambah_submit
        ? dataKunci.tambah_submit.filter((_, idx) => indeksCocok.includes(idx))
        : [],
    };
  }

  btnChart.style.backgroundColor = "";
  btnChart.style.color = "";
  btnTable.style.backgroundColor = "";
  btnTable.style.color = "";

  if (view === "chart") {
    btnChart.querySelector("i").classList.add("text-amber-500");
    btnTable.querySelector("i").classList.remove("text-amber-500");
    btnChart.querySelector("span").classList.add("text-amber-500");
    btnTable.querySelector("span").classList.remove("text-amber-500");
    btnChart.className =
      "theme-transition flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium shadow-xs cursor-pointer";
    btnChart.style.backgroundColor = isDark ? "#334155" : "#ffffff";
    btnChart.style.color = isDark ? "#ffffff" : "#0f172a";

    btnTable.className =
      "theme-transition flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer";

    wrapperChart.classList.remove("hidden");
    wrapperTable.classList.add("hidden");
    renderChart(dataKunci);
  } else {
    btnTable.querySelector("i").classList.add("text-amber-500");
    btnChart.querySelector("i").classList.remove("text-amber-500");
    btnTable.querySelector("span").classList.add("text-amber-500");
    btnChart.querySelector("span").classList.remove("text-amber-500");
    btnTable.className =
      "theme-transition flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium shadow-xs cursor-pointer";
    btnTable.style.backgroundColor = isDark ? "#334155" : "#ffffff";
    btnTable.style.color = isDark ? "#ffffff" : "#0f172a";

    btnChart.className =
      "theme-transition flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 cursor-pointer";

    wrapperChart.classList.add("hidden");
    wrapperTable.classList.remove("hidden");
    renderTable(dataKunci);
  }
}
