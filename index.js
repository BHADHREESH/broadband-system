(() => {
    const year = new Date().getFullYear();
    const copyright = document.getElementById("copyrightText");

    if (copyright) {
        copyright.textContent = `(c) ${year} NetWave Broadband. All rights reserved.`;
    }
})();
