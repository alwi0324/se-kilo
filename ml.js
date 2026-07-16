let currentMenu = "kecamatan";
let currentView = "chart";
let myChart = null;
let activeData = null;

let globalKecData = null;
let globalPplData = null;
let globalPmlData = null;

let globalPsgKecProgress = null;
let selectedPml = "";
let selectedPpl = "";
let globalSlsDataRaw = [];
let globalPsgPplPml = [];

function updateDashboardData(whatData) {
  let data = whatData;

  if (currentMenu === "ppl" && selectedPml !== "Semua" && data) {
    // Cari indeks mana saja yang memiliki PML sesuai pilihan
    const indeksCocok = [];
    globalPsgPplPml.forEach((item, index) => {
      if (item.pml === selectedPml) {
        indeksCocok.push(index);
      }
    });

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
      revoked: whatData.revoked.filter((_, idx) => indeksCocok.includes(idx)),
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

  const elMainTitle = document.getElementById("main-title");
  const elThName = document.getElementById("th-name");
  const elStatTarget = document.getElementById("stat-target");
  const elStatBelum = document.getElementById("stat-blm-terdata");
  const elStatReal = document.getElementById("stat-realisasi");
  const elStatPersen = document.getElementById("stat-persen");

  if (elMainTitle) elMainTitle.innerText = data.title;

  // BINDING DATA UPDATE SECARA AMAN
  const elUpdate = document.getElementById("dashboard-update");
  if (elUpdate && data.lastUpdate) {
    elUpdate.innerHTML = `<i class="fa-regular fa-clock text-amber-500"></i> <span>${data.lastUpdate}</span>`;
  }
  if (elThName) elThName.innerText = data.thName;

  if (elStatTarget) elStatTarget.innerText = data.stats.target;
  if (elStatBelum) elStatBelum.innerText = data.stats.open;
  if (elStatReal) elStatReal.innerText = data.stats.realisasi;
  if (elStatPersen) elStatPersen.innerText = data.stats.persen;

  if (currentView === "chart") {
    renderChart(data);
  } else {
    renderTable(data);
  }
}

function renderTable(whatData) {
  let dataContent = whatData;
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

  const isPmlMenu = currentMenu === "pml";
  const isSlsMenu = currentMenu === "sls";
  const theadRow = document.querySelector("#wrapper-table table thead tr");

  if (theadRow) {
    theadRow.innerHTML = `
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-20 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">${dataContent.thName}</th>
    <th class="py-3 px-4 text-center sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Progress</th>
    ${isPmlMenu || isSlsMenu ? `<th class="py-3 px-4 text-center sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Terverifikasi</th>` : ""}
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Muatan</th>
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Terdata</th>
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Open</th>
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Pending</th>
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Draft</th>
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Approved</th>
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Rejected</th>
    <th class="py-3 px-4 text-left sticky top-0 left-0 bg-slate-100 dark:bg-[#1e293b] z-10 text-slate-500 dark:text-slate-400 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Revoked</th>
  `;
  }

  dataContent.labels.forEach((label, index) => {
    const tgt = dataContent.target[index];
    const percentage = dataContent.progress[index];
    const open = dataContent.open[index];
    const submit = dataContent.submit[index];
    const draft = dataContent.draft[index];
    const approved = dataContent.approved[index];
    const revoked = dataContent.revoked[index];
    const rejected = dataContent.rejected[index];
    const real = dataContent.realisasi
      ? dataContent.realisasi[index]
      : (submit || 0) + (approved || 0) + (rejected || 0) + (revoked || 0);
    const verifPct =
      (isPmlMenu || isSlsMenu) && dataContent.verifikasi
        ? dataContent.verifikasi[index] || 0
        : 0;
    const row = document.createElement("tr");
    row.className = "theme-transition border-b border-slate-100";
    row.innerHTML = `
            <td class="py-4 px-4 whitespace-normal font-medium text-slate-950 sticky left-0 bg-white dark:bg-slate-800 z-10">${label}</td>
            <td class="py-4 px-4">
                <div class="flex items-center space-x-3 justify-end">
                    <div class="w-24 bg-slate-800 h-2 rounded-full overflow-visible hidden sm:block">
                        <!-- Progress Bar dengan Efek Neon Glow Halus -->
                        <div class="bg-amber-400 h-full rounded-full transition-all duration-500" 
                             style="width: ${percentage}%; box-shadow: 0 0 8px rgba(245, 158, 11, 0.6), 0 0 2px rgba(245, 158, 11, 0.8);">
                        </div>
                    </div>
                    <span class="font-semibold text-xs w-10 text-right text-amber-500 shadow-xs">${percentage.toLocaleString("id-ID")}%</span>
                </div>
            </td>
            ${
              isPmlMenu || isSlsMenu
                ? `
            <td class="py-4 px-4">
                <div class="flex items-center space-x-3 justify-end">
                    <div class="w-24 bg-slate-800 h-2 rounded-full overflow-visible hidden sm:block">
                        <div class="bg-cyan-400 h-full rounded-full transition-all duration-500" 
                             style="width: ${verifPct}%; box-shadow: 0 0 8px rgba(34, 211, 238, 0.6), 0 0 2px rgba(34, 211, 238, 0.8);">
                        </div>
                    </div>
                    <span class="font-semibold text-xs w-10 text-right text-cyan-400">${verifPct.toLocaleString("id-ID")}%</span>
                </div>
            </td>
            `
                : ""
            }
            <td class="py-4 px-4 text-right">${tgt.toLocaleString("id-ID")}</td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-green-600">${real.toLocaleString("id-ID")}</span></td>
            <td class="py-4 px-4 text-right">${open.toLocaleString("id-ID")}</td>
            <td class="py-4 px-4 text-right">${submit.toLocaleString("id-ID")}</td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-yellow-500">${draft.toLocaleString("id-ID")}</span></td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-blue-500">${approved.toLocaleString("id-ID")}</span></td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-red-500">${rejected.toLocaleString("id-ID")}</span></td>
            <td class="py-4 px-4 text-right"><span class="font-semibold text-purple-500">${revoked.toLocaleString("id-ID")}</span></td>
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
          display: function (context) {
            const value = context.dataset.data[context.dataIndex];

            return value > 0;
          },
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
              const tgt =
                dataContent.target && dataContent.target[idx] !== undefined
                  ? dataContent.target[idx].toLocaleString("id-ID")
                  : "0";

              const open =
                dataContent.open && dataContent.open[idx] !== undefined
                  ? dataContent.open[idx].toLocaleString("id-ID")
                  : "0";

              const real =
                dataContent.realisasi &&
                dataContent.realisasi[idx] !== undefined
                  ? dataContent.realisasi[idx].toLocaleString("id-ID")
                  : "0";
              const pct = context.parsed.x;
              const draft =
                dataContent.draft && dataContent.draft[idx] !== undefined
                  ? dataContent.draft[idx].toLocaleString("id-ID")
                  : "0";

              if (currentMenu === "ppl") {
                const pmlMatch = globalPsgPplPml.find(
                  (item) =>
                    item.ppl.toLowerCase() === context.label.toLowerCase(),
                );
                const namaPml = pmlMatch ? pmlMatch.pml : "-";
                const tambahSubmitNilai =
                  dataContent.tambah_submit && dataContent.tambah_submit[idx]
                    ? dataContent.tambah_submit[idx].toLocaleString("id-ID")
                    : "0";

                return [
                  `Progress: ${pct.toLocaleString("id-ID")}%`,
                  `PML: ${namaPml}`,
                  `Sudah Didata: ${real}`,
                  `Belum Didata: ${open}`,
                  `Draft: ${draft}`,
                  `Total Muatan: ${tgt}`,
                  `Tambah Submit: ${tambahSubmitNilai}`,
                ];
              } else if (currentMenu === "pml") {
                const verif = dataContent.verifikasi[idx] || 0;
                return [
                  `Progress: ${pct.toLocaleString("id-ID")}%`,
                  `Terverifikasi: ${verif.toLocaleString("id-ID")}%`,
                  `Sudah Didata: ${real}`,
                  `Belum Didata: ${open}`,
                  `Draft: ${draft}`,
                  `Total Muatan: ${tgt}`,
                ];
              } else if (currentMenu === "sls") {
                const namaDesa =
                  dataContent.desa && dataContent.desa[idx]
                    ? dataContent.desa[idx]
                    : "-";
                return [
                  `Progress: ${pct.toLocaleString("id-ID")}%`,
                  `Desa: ${namaDesa}`,
                  `Sudah Didata: ${real}`,
                  `Belum Didata: ${open}`,
                  `Draft: ${draft}`,
                  `Total Muatan: ${tgt}`,
                ];
              } else {
                return [
                  `Progress: ${pct.toLocaleString("id-ID")}%`,
                  `Sudah Didata: ${real}`,
                  `Belum Didata: ${open}`,
                  `Draft: ${draft}`,
                  `Total Muatan: ${tgt}`,
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

function dataSLSHandler(data) {
  globalSlsDataRaw = data;
  buildSlsDashboard();
}

const dataKecHandler = (data) => {
  const nmKec = data.map((e) => kapitalTiapKata(e.kec.replace("'", "")));
  const blm_didata = data.map((e) => e.open).reduce((a, b) => a + b);
  const targetPerKec = data.map((e) => e.target);
  const realisasiPerKec = data.map(
    (e) => e.submit + e.approved + e.rejected + e.revoked,
  );
  const persenPerKec = data.map((e) => e.progress);
  const revokedPerKec = data.map((e) => e.revoked || 0); // Default ke 0 jika undefined

  const psgKecProgress = Object.fromEntries(
    nmKec.map((nama, indeks) => [nama.toLowerCase(), persenPerKec[indeks]]),
  );
  globalPsgKecProgress = psgKecProgress;

  const terdata =
    data.map((e) => e.submit).reduce((a, b) => a + b) +
    data.map((e) => e.approved).reduce((a, b) => a + b) +
    data.map((e) => e.rejected).reduce((a, b) => a + b) +
    data.map((e) => e.revoked).reduce((a, b) => a + b);

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
    revoked: data.map((e) => e.revoked.toLocaleString("id-ID")),
    target: targetPerKec,
    realisasi: realisasiPerKec,
    progress: persenPerKec,
    lastUpdate: data[0].update,
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
  const realisasiPerPPL = data.map(
    (e) => e.submit + e.approved + e.rejected + e.revoked,
  );
  const persenPerPPL = data.map((e) => e.progress);
  const tambahSubmit = data.map((e) => e.tambah_submit || 0); // Default ke 0 jika undefined

  globalPsgPplPml = data.map((e) => ({
    ppl: e.ppl,
    pml: e.pml,
  }));

  const dropdown = document.getElementById("filter-pml");
  if (dropdown) {
    // ─── PERBAIKAN: Setel nilai selectedPml ke PML Pertama jika ada ───
    if (nmPML.length > 0) {
      selectedPml = nmPML[0];
    } else {
      selectedPml = "Semua";
    }

    // Masukkan nama-nama PML dan tambahkan atribut 'selected' otomatis pada PML pertama
    nmPML.forEach((pml, index) => {
      const isSelected = index === 0 ? "selected" : "";
      dropdown.innerHTML += `<option value="${pml}" ${isSelected}>${pml}</option>`;
    });

    // Event listener saat user mengubah filter dropdown
    dropdown.onchange = (event) => {
      handlePmlFilterChange(event.target.value);
    };
  }

  const terdata =
    data.map((e) => e.submit).reduce((a, b) => a + b) +
    data.map((e) => e.approved).reduce((a, b) => a + b) +
    data.map((e) => e.rejected).reduce((a, b) => a + b) +
    data.map((e) => e.revoked).reduce((a, b) => a + b);

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
    revoked: data.map((e) => e.revoked.toLocaleString("id-ID")),
    target: targetPerPPL,
    realisasi: realisasiPerPPL,
    progress: persenPerPPL,
    tambah_submit: tambahSubmit,
    lastUpdate: data[0].update,
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
  const realisasiPerPML = data.map(
    (e) => e.submit + e.approved + e.rejected + e.revoked,
  );
  const persenPerPML = data.map((e) => e.progress);
  const verif = data.map((e) => e.terverifikasi || 0);

  const terdata =
    data.map((e) => e.submit).reduce((a, b) => a + b) +
    data.map((e) => e.approved).reduce((a, b) => a + b) +
    data.map((e) => e.rejected).reduce((a, b) => a + b) +
    data.map((e) => e.revoked).reduce((a, b) => a + b);

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
    revoked: data.map((e) => e.revoked.toLocaleString("id-ID")),
    target: targetPerPML,
    realisasi: realisasiPerPML,
    progress: persenPerPML,
    verifikasi: verif,
    lastUpdate: data[0].update,
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

function buildSlsDashboard() {
  const pmlDropdown = document.getElementById("filter-pml");
  const pplDropdown = document.getElementById("filter-ppl");

  if (!globalSlsDataRaw || globalSlsDataRaw.length === 0) return;

  // 1. Ekstrak daftar unik PML untuk dropdown
  const uniquePml = [
    ...new Set(globalSlsDataRaw.map((item) => item.pml)),
  ].filter(Boolean);
  pmlDropdown.innerHTML = uniquePml
    .map((pml) => `<option value="${pml}">${pml}</option>`)
    .join("");

  selectedPml = uniquePml[0] || "";
  pmlDropdown.value = selectedPml;

  // 2. Filter daftar PPL yang HANYA berada di bawah PML terpilih
  const filteredPpls = [
    ...new Set(
      globalSlsDataRaw
        .filter((item) => item.pml === selectedPml)
        .map((item) => item.ppl),
    ),
  ].filter(Boolean);

  pplDropdown.innerHTML = filteredPpls
    .map((ppl) => `<option value="${ppl}">${ppl}</option>`)
    .join("");

  // Pastikan PPL terpilih disesuaikan dengan daftar PPL baru hasil filter PML
  if (!selectedPpl || !filteredPpls.includes(selectedPpl)) {
    selectedPpl = filteredPpls[0] || "";
  }
  pplDropdown.value = selectedPpl;

  // 3. Proses data untuk grafik dan tabel
  processSlsData();
}

function handlePmlFilterChange(pmlValue) {
  selectedPml = pmlValue; // Simpan nilai PML terpilih

  if (currentMenu === "sls") {
    // 1. Dapatkan daftar PPL baru yang berada di bawah PML ini
    const filteredPpls = [
      ...new Set(
        globalSlsDataRaw
          .filter((item) => item.pml === selectedPml)
          .map((item) => item.ppl),
      ),
    ].filter(Boolean);

    // 2. Set default PPL ke orang pertama di dalam PML baru tersebut
    selectedPpl = filteredPpls[0] || "";

    // 3. Ambil elemen dropdown PPL dan perbarui isinya secara manual di sini
    const pplDropdown = document.getElementById("filter-ppl");
    if (pplDropdown) {
      pplDropdown.innerHTML = filteredPpls
        .map((ppl) => `<option value="${ppl}">${ppl}</option>`)
        .join("");
      pplDropdown.value = selectedPpl;
    }

    // 4. Proses data SLS (Fungsi ini otomatis memanggil updateDashboardData dan render chart/tabel)
    processSlsData();
  } else if (currentMenu === "ppl") {
    // Jika sedang di menu PPL, perbarui dashboard menggunakan data PPL global
    // Logika filter per-PML-nya sudah ditangani otomatis oleh fungsi updateDashboardData
    updateDashboardData(globalPplData);
  }
}

function handlePplFilterChange(pplValue) {
  selectedPpl = pplValue;
  processSlsData();
}

// Mengompilasi data SLS terpilih menjadi bentuk struktur activeData objek dashboard
function processSlsData() {
  const rows = globalSlsDataRaw.filter(
    (item) => item.pml === selectedPml && item.ppl === selectedPpl,
  );

  const slsData = {
    title: `Progress SLS per PPL: ${selectedPpl}`,
    thName: "SLS",
    lastUpdate:
      globalSlsDataRaw[0] && globalSlsDataRaw[0].update
        ? globalSlsDataRaw[0].update
        : "Data tidak diketahui",
    labels: rows.map((r) => r.sls || ""),
    desa: rows.map((r) => r.desa || ""),
    target: rows.map((r) => Number(r.target) || 0),
    open: rows.map((r) => Number(r.open) || 0),
    realisasi: rows.map(
      (r) =>
        parseFloat(r.submit) +
          parseFloat(r.approved) +
          parseFloat(r.rejected) +
          parseFloat(r.revoked) || 0,
    ),
    submit: rows.map((r) => Number(r.submit) || 0),
    draft: rows.map((r) => Number(r.draft) || 0),
    approved: rows.map((r) => Number(r.approved) || 0),
    rejected: rows.map((r) => Number(r.rejected) || 0),
    revoked: rows.map((r) => Number(r.revoked) || 0),
    progress: rows.map((r) => Number(r.progress) || 0),
    verifikasi: rows.map(
      (r) => Number(r.progress_verifikasi) || Number(r.terverifikasi) || 0,
    ),
    stats: {
      target: rows.reduce((acc, r) => acc + (Number(r.target) || 0), 0),
      open: rows.reduce((acc, r) => acc + (Number(r.open) || 0), 0),
      realisasi: rows.reduce(
        (acc, r) =>
          acc +
          ((Number(r.submit) || 0) +
            (Number(r.approved) || 0) +
            (Number(r.rejected) || 0) +
            (Number(r.revoked) || 0)),
        0,
      ),
      persen: 0,
    },
  };

  if (slsData.stats.target > 0) {
    const hitungPersen = (slsData.stats.realisasi / slsData.stats.target) * 100;
    slsData.stats.persen = hitungPersen.toFixed(2).replace(".", ",") + "%";
  } else {
    slsData.stats.persen = "0,00%";
  }

  activeData = slsData;
  updateDashboardData(activeData);

  // Paksa render sesuai dengan view yang sedang aktif saat ini!
  if (currentView === "table") {
    renderTable(activeData);
  } else {
    if (typeof renderChart === "function") renderChart(activeData);
  }
}

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
  const pplFilterWrapper = document.getElementById("ppl-filter-wrapper");

  ["kecamatan", "ppl", "pml", "sls"].forEach((m) => {
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
    updateDashboardData(activeData);
  } else if (menu === "ppl") {
    filterContainer.classList.remove("hidden");
    pplFilterWrapper.classList.add("hidden");
    activeData = globalPplData;

    const dropdown = document.getElementById("filter-pml");
    if (dropdown && selectedPml) dropdown.value = selectedPml;
    updateDashboardData(activeData);
  } else if (menu === "sls") {
    filterContainer.classList.remove("hidden");
    pplFilterWrapper.classList.remove("hidden"); // Munculkan filter PPL

    if (globalSlsDataRaw && globalSlsDataRaw.length > 0) {
      buildSlsDashboard();
    } else {
      // Panggil API getSheetData jika data SLS belum terload
      getSheetData({
        query: "SELECT *",
        sheet: "SLS",
        callback: dataSLSHandler,
      });
    }
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

  // KUNCI PERBAIKAN: Tentukan dataKunci berdasarkan menu yang sedang aktif
  let dataKunci = globalKecData;
  if (currentMenu === "ppl") {
    dataKunci = globalPplData;
  } else if (currentMenu === "pml") {
    dataKunci = globalPmlData;
  } else if (currentMenu === "sls") {
    // Untuk menu SLS, gunakan data olahan aktif yang sudah terfilter PPL
    dataKunci = activeData;
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
