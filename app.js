document.addEventListener('DOMContentLoaded', async () => {
    const url = 'konyvem.pdf';
    const bookContainer = document.getElementById('book');
    const loadingText = document.getElementById('loading-text');
    const loadingState = document.getElementById('loading-state');
    const modeSelectionState = document.getElementById('mode-selection-state');
    const modeSelector = document.getElementById('mode-selector');

    let pdfDoc = null;
    let pageFlip = null;

    try {
        console.log("Loading PDF...");
        const loadingTask = pdfjsLib.getDocument(url);
        pdfDoc = await loadingTask.promise;
        console.log("PDF loaded. Pages: " + pdfDoc.numPages);

        // Initialize PageFlip
        // We defer initialization until we determine dimensions, 
        // but for now we'll create standard pages.

        // Render all pages to canvases
        // Note: For very large PDFs, lazy loading is better. 
        // For < 50 pages, rendering all at once is okay-ish but can be slow.
        // Let's create the DOM elements first.

        const firstPage = await pdfDoc.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        const aspectRatio = viewport.width / viewport.height;

        // Calculate base dimensions keeping the aspect ratio
        // We can set a base height and calculate width from it, or vice versa.
        // Let's stick to a reasonable base height for desktop.
        // Calculate dimensions to fit screen
        const padding = 20; // safe area
        const availableWidth = window.innerWidth - padding;
        const availableHeight = window.innerHeight - padding;

        // Target height: try to use most of the height
        // Spread Aspect Ratio = (PageWidth * 2) / PageHeight
        // Page AR = viewport.width / viewport.height
        const pageAR = viewport.width / viewport.height;
        const spreadAR = pageAR * 2;

        console.log(`Page AR: ${pageAR}, Spread AR: ${spreadAR}`);

        // We want to fit a rectangle with aspect ratio 'spreadAR' into 'availableWidth' x 'availableHeight'
        let baseWidth = availableWidth;
        let baseHeight = baseWidth / spreadAR;

        if (baseHeight > availableHeight) {
            baseHeight = availableHeight;
            baseWidth = baseHeight * spreadAR;
        }

        console.log(`PDF Dimensions: ${viewport.width}x${viewport.height}, Ratio: ${aspectRatio}`);
        console.log(`Flipbook Dimensions: ${baseWidth}x${baseHeight}`);

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'my-page';
            // We can add a "density" attribute or "data-density" for hard covers if needed
            if (pageNum === 1 || pageNum === pdfDoc.numPages) {
                pageDiv.setAttribute('data-density', 'hard');
            } else {
                pageDiv.setAttribute('data-density', 'soft');
            }

            const canvas = document.createElement('canvas');
            canvas.id = `page-${pageNum}`;
            pageDiv.appendChild(canvas);
            bookContainer.appendChild(pageDiv);
        }

        // Initialize the library
        pageFlip = new St.PageFlip(bookContainer, {
            width: baseWidth / 2,
            height: baseHeight,
            size: "fixed",
            usePortrait: false, // FORCE 2-PAGE SPREAD
            // maxWidth: 1500,
            // minHeight: 400,
            // maxHeight: 1200,
            showCover: true,
            maxShadowOpacity: 0
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.my-page'));

        // Now render the PDF pages onto the canvases
        // We render all pages and wait for them to finish before showing the UI
        const renderPromises = [];
        let pagesLoaded = 0;

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            renderPromises.push(renderPage(i, pdfDoc, () => {
                pagesLoaded++;
                loadingText.textContent = `Betöltés... ${pagesLoaded} / ${pdfDoc.numPages}`;
            }));
        }

        // catch individual render errors via the main try/catch block if we rethrow
        await Promise.all(renderPromises);
        console.log("All pages rendered.");

        // Switch to Mode Selection
        loadingState.style.display = 'none';
        modeSelectionState.style.display = 'block';

        // Show Mode Selector
        const btnManual = document.getElementById('btn-manual');
        const btnAuto = document.getElementById('btn-auto');

        btnManual.addEventListener('click', () => {
            toggleFullScreen();
            modeSelector.style.display = 'none';
        });

        btnAuto.addEventListener('click', () => {
            toggleFullScreen();
            modeSelector.style.display = 'none';
            startAutoFlip(pageFlip, pdfDoc.numPages);
        });

    } catch (error) {
        console.error('Error loading PDF:', error);
        loadingText.textContent = 'Hiba történt: ' + error.message;
    }
});

function startAutoFlip(pageFlip, totalPages) {
    const interval = setInterval(() => {
        // Check if we are at the last page
        const current = pageFlip.getCurrentPageIndex(); // 0-indexed

        // pageFlip uses 0-based index. Total pages is 1-based count.
        // If we have 10 pages, indices are 0..9.
        // However, in 2-page view, the index might behave differently depending on the library.
        // simple-page-flip usually returns the index of the left page or the single page.

        // Let's just try to flip next.
        if (current < totalPages - 1) {
            pageFlip.flipNext();
        } else {
            clearInterval(interval);
            console.log("Auto-flip finished.");
        }
    }, 5000);
}

async function renderPage(num, pdfDoc, updateCallback) {
    try {
        const page = await pdfDoc.getPage(num);
        const canvas = document.getElementById(`page-${num}`);
        const ctx = canvas.getContext('2d');

        // Calculate scale to fit the canvas quality
        // We want high res. 
        const viewport = page.getViewport({ scale: 2 }); // Render at 2x scale for sharpness

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext).promise;

        // Update loading text if callback provided
        if (updateCallback) updateCallback();

    } catch (e) {
        console.error("Error rendering page " + num, e);
        const loadingText = document.getElementById('loading-text');
        if (loadingText) {
            loadingText.textContent = `Hiba a(z) ${num}. oldalon: ${e.message}`;
            loadingText.style.color = 'red';
        }
        // Rethrow to stop Promise.all if we want to block? 
        // Or just let it show the error.
        // Let's throw so the main catch block might behave differently, 
        // OR just rely on the text being red.
        throw e;
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
            console.log(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
    }
}
