document.addEventListener('DOMContentLoaded', async () => {
    const url = 'konyvem.pdf';
    const bookContainer = document.getElementById('book');
    const loading = document.getElementById('loading');

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
        const baseHeight = 800;
        const baseWidth = baseHeight * aspectRatio;

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
            width: baseWidth,
            height: baseHeight,
            size: "stretch",
            minWidth: 300,
            maxWidth: 1500,
            minHeight: 400,
            maxHeight: 1200,
            showCover: true,
            maxShadowOpacity: 0.5
        });

        pageFlip.loadFromHTML(document.querySelectorAll('.my-page'));

        loading.style.display = 'none';

        // Show Mode Selector
        const modeSelector = document.getElementById('mode-selector');
        const btnManual = document.getElementById('btn-manual');
        const btnAuto = document.getElementById('btn-auto');

        modeSelector.style.display = 'flex';

        btnManual.addEventListener('click', () => {
            modeSelector.style.display = 'none';
        });

        btnAuto.addEventListener('click', () => {
            modeSelector.style.display = 'none';
            startAutoFlip(pageFlip, pdfDoc.numPages);
        });

        // Now render the PDF pages onto the canvases
        // We render them as they are needed? Or all?
        // Let's render all for simplicity for now, but async.

        for (let i = 1; i <= pdfDoc.numPages; i++) {
            renderPage(i, pdfDoc);
        }

    } catch (error) {
        console.error('Error loading PDF:', error);
        loading.textContent = 'Hiba történt a fájl betöltésekor: ' + error.message;
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

async function renderPage(num, pdfDoc) {
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
    } catch (e) {
        console.error("Error rendering page " + num, e);
    }
}
