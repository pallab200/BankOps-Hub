// script.js - combine up to two images into one stacked image and offer download
const file1 = document.getElementById('file1');
const file2 = document.getElementById('file2');
const thumb1 = document.getElementById('thumb1');
const thumb2 = document.getElementById('thumb2');
const combineBtn = document.getElementById('combine');
const clearBtn = document.getElementById('clear');
const previewCanvas = document.getElementById('previewCanvas');
const spacingInput = document.getElementById('spacing');
const bgcolorInput = document.getElementById('bgcolor');
// Removed UI controls: outWidth, format select and quality slider.
// Use defaults instead of querying removed DOM elements.
const DEFAULT_QUALITY = 0.9; // 90%
const progressWrap = document.getElementById('progress');
const progressBar = document.getElementById('progressBar');

const cropBtn1 = document.getElementById('crop1');
const cropBtn2 = document.getElementById('crop2');
const cropModal = document.getElementById('cropModal');
const cropCanvas = document.getElementById('cropCanvas');
const cropTitle = document.getElementById('cropTitle');
const applyCropBtn = document.getElementById('applyCrop');
const cancelCropBtn = document.getElementById('cancelCrop');
const cropInfo1 = document.getElementById('cropInfo1');
const cropInfo2 = document.getElementById('cropInfo2');

let img1 = null, img2 = null;
let cropRects = {1: null, 2: null}; // store {x,y,w,h} in original image pixels

function setProgress(p){
  progressWrap.classList.remove('hidden');
  progressBar.style.width = (Math.max(0, Math.min(100, p))) + '%';
  if(p >= 100) setTimeout(()=>progressWrap.classList.add('hidden'), 400);
}

function readFileToImg(file, cb){
  if(!file) return cb(null);
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => cb(img);
    img.onerror = () => cb(null);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

file1.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  setProgress(5);
  readFileToImg(f, (img)=>{
    img1 = img;
    thumb1.src = img ? img.src : '';
    document.getElementById('preview1').src = img ? img.src : '';
    document.getElementById('preview1-container').style.display = img ? 'block' : 'none';
    cropRects[1] = null;
    cropInfo1.textContent = '';
    setProgress(30);
  });
});

file2.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  setProgress(5);
  readFileToImg(f, (img)=>{
    img2 = img;
    thumb2.src = img ? img.src : '';
    document.getElementById('preview2').src = img ? img.src : '';
    document.getElementById('preview2-container').style.display = img ? 'block' : 'none';
    cropRects[2] = null;
    cropInfo2.textContent = '';
    setProgress(30);
  });
});

// Drag-and-drop support for dropzones
function setupDropzone(id, targetIndex){
  const el = document.getElementById(id);
  el.addEventListener('dragover', e=>{ e.preventDefault(); el.classList.add('dragover'); });
  el.addEventListener('dragleave', e=>{ el.classList.remove('dragover'); });
  el.addEventListener('drop', e=>{
    e.preventDefault(); el.classList.remove('dragover');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if(!f) return;
    setProgress(5);
    readFileToImg(f, (img)=>{
      if(targetIndex===1){ img1 = img; thumb1.src = img ? img.src : ''; cropRects[1]=null; cropInfo1.textContent=''; }
      else { img2 = img; thumb2.src = img ? img.src : ''; cropRects[2]=null; cropInfo2.textContent=''; }
      setProgress(30);
    });
  });
}

setupDropzone('drop1', 1);
setupDropzone('drop2', 2);

// Crop modal logic: quadrilateral crop with independent corner points and perspective transform support
let croppingTarget = null; // 1 or 2
let cropDrawScale = 1; // scale from original image to canvas display
let cropDisplayImg = null; // the image currently shown
let cropRectDisplay = null; // array of 4 points in display coords: [tl,tr,br,bl]
let cropMode = null; // 'none' | 'move' | 'resize' | 'create'
let activeHandle = null; // 0..3 index of corner
let dragOffset = {dx:0, dy:0};
const HANDLE_SIZE = 12; // diameter for the circular dot handles

function openCropModal(target){
  const img = target===1 ? img1 : img2;
  if(!img){ alert('No image loaded for cropping.'); return; }
  croppingTarget = target;
  cropDisplayImg = img;
  cropTitle.textContent = 'Crop Image ' + target + ' (drag corners or move polygon)';
  // size canvas to image but limit to max width/height for screen
  const maxW = Math.min(window.innerWidth * 0.8, 1000);
  const maxH = Math.min(window.innerHeight * 0.7, 700);
  let dw = img.width, dh = img.height;
  const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
  dw = Math.round(img.width * ratio);
  dh = Math.round(img.height * ratio);
  cropCanvas.width = dw;
  cropCanvas.height = dh;
  cropDrawScale = img.width / dw; // multiply displayed coords to get original

  // initialize display quad from existing crop (support both rectangular and quad) or default centered rect
  const existing = cropRects[target];
  if(existing && existing.quad && Array.isArray(existing.quad) && existing.quad.length===4){
    cropRectDisplay = existing.quad.map(p => ({ x: Math.round(p.x / cropDrawScale), y: Math.round(p.y / cropDrawScale) }));
  } else if(existing && typeof existing.x === 'number'){
    // old rectangular format
    const rx = Math.round(existing.x / cropDrawScale), ry = Math.round(existing.y / cropDrawScale);
    const rw = Math.round(existing.w / cropDrawScale), rh = Math.round(existing.h / cropDrawScale);
    cropRectDisplay = [
      {x: rx, y: ry},
      {x: rx + rw, y: ry},
      {x: rx + rw, y: ry + rh},
      {x: rx, y: ry + rh}
    ];
  } else {
    // default: centered 60% rectangle converted to quad
    const w = Math.round(dw * 0.6);
    const h = Math.round(dh * 0.6);
    const x0 = Math.round((dw - w)/2), y0 = Math.round((dh - h)/2);
    cropRectDisplay = [
      {x: x0, y: y0},
      {x: x0 + w, y: y0},
      {x: x0 + w, y: y0 + h},
      {x: x0, y: y0 + h}
    ];
  }

  cropMode = 'none'; activeHandle = null;
  drawCropRectOnCanvas(cropRectDisplay);
  cropModal.classList.remove('hidden');
}

function drawCropRectOnCanvas(r){
  const ctx = cropCanvas.getContext('2d');
  ctx.clearRect(0,0,cropCanvas.width,cropCanvas.height);
  ctx.drawImage(cropDisplayImg, 0, 0, cropDisplayImg.width, cropDisplayImg.height, 0, 0, cropCanvas.width, cropCanvas.height);
  if(!r || !Array.isArray(r) || r.length !== 4) return;
  // shaded outside (use polygon)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.rect(0,0,cropCanvas.width,cropCanvas.height);
  ctx.moveTo(r[0].x, r[0].y);
  for(let i=1;i<4;i++) ctx.lineTo(r[i].x, r[i].y);
  ctx.closePath();
  ctx.fill('evenodd');
  ctx.restore();

  // polygon border
  ctx.strokeStyle = '#ffcc00';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(r[0].x, r[0].y);
  for(let i=1;i<4;i++) ctx.lineTo(r[i].x, r[i].y);
  ctx.closePath();
  ctx.stroke();

  // corner handles (circular dots)
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#333';
  for(const p of r){
    ctx.beginPath();
    ctx.arc(p.x, p.y, HANDLE_SIZE/2, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }
}

function getHandles(r){
  // return array of {name,index,x,y}
  return r.map((p,i)=>({name:['nw','ne','se','sw'][i], index:i, x:p.x, y:p.y}));
}

function hitTestHandle(px, py, r){
  if(!r) return null;
  const handles = getHandles(r);
  for(const h of handles){
    const dx = px - h.x;
    const dy = py - h.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist <= HANDLE_SIZE) return h.index; // return index of handle
  }
  return null;
}

function insidePolygon(px, py, poly){
  if(!poly || poly.length<3) return false;
  // ray-casting algorithm
  let inside = false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi>py) !== (yj>py)) && (px < (xj - xi) * (py - yi) / (yj - yi + 0.0) + xi);
    if(intersect) inside = !inside;
  }
  return inside;
}

cropCanvas.addEventListener('mousedown', (e)=>{
  const rectB = cropCanvas.getBoundingClientRect();
  const x = Math.round(e.clientX - rectB.left);
  const y = Math.round(e.clientY - rectB.top);
  const h = hitTestHandle(x,y,cropRectDisplay);
  if(h !== null){ cropMode = 'resize'; activeHandle = h; return; }
  if(insidePolygon(x,y,cropRectDisplay)){
    cropMode = 'move';
    // compute offset origin for move
    dragOffset.dx = x; dragOffset.dy = y;
    return;
  }
  // else start creating a new rectangle from this point
  cropMode = 'create';
  cropRectDisplay = [{x, y}, {x, y}, {x, y}, {x, y}];
});

cropCanvas.addEventListener('mousemove', (e)=>{
  const rectB = cropCanvas.getBoundingClientRect();
  const x = Math.round(e.clientX - rectB.left);
  const y = Math.round(e.clientY - rectB.top);
  if(cropMode === 'none'){
    // change cursor depending on which handle or area
    const h = hitTestHandle(x,y,cropRectDisplay);
    if(h !== null){
      // choose diagonal cursor based on handle index
      if(h === 0 || h === 2) cropCanvas.style.cursor = 'nwse-resize';
      else cropCanvas.style.cursor = 'nesw-resize';
    }
    else if(insidePolygon(x,y,cropRectDisplay)) cropCanvas.style.cursor = 'move';
    else cropCanvas.style.cursor = 'crosshair';
    return;
  }
  // perform interaction
  const minSize = 6;
  if(cropMode === 'create'){
    // create a new axis-aligned rectangle from start point to current and convert to quad
    const start = cropRectDisplay[0];
    const x0 = Math.min(start.x, x), y0 = Math.min(start.y, y);
    const x1 = Math.max(start.x, x), y1 = Math.max(start.y, y);
    cropRectDisplay = [ {x:x0,y:y0}, {x:x1,y:y0}, {x:x1,y:y1}, {x:x0,y:y1} ];
    drawCropRectOnCanvas(cropRectDisplay);
  } else if(cropMode === 'move'){
    // translate all points by delta
    const dx = x - dragOffset.dx;
    const dy = y - dragOffset.dy;
    // update drag origin
    dragOffset.dx = x; dragOffset.dy = y;
    // apply and clamp
    for(const p of cropRectDisplay){ p.x = Math.max(0, Math.min(cropCanvas.width, p.x + dx)); p.y = Math.max(0, Math.min(cropCanvas.height, p.y + dy)); }
    drawCropRectOnCanvas(cropRectDisplay);
  } else if(cropMode === 'resize'){
    // move only the active handle point
    const idx = activeHandle;
    cropRectDisplay[idx].x = Math.max(0, Math.min(cropCanvas.width, x));
    cropRectDisplay[idx].y = Math.max(0, Math.min(cropCanvas.height, y));
    drawCropRectOnCanvas(cropRectDisplay);
  }
});

cropCanvas.addEventListener('mouseup', (e)=>{
  // finish any action
  cropMode = 'none'; activeHandle = null;
});

applyCropBtn.addEventListener('click', ()=>{
  if(!cropRectDisplay || !croppingTarget) { cropModal.classList.add('hidden'); return; }
  // convert quad display points to original image pixel coordinates and store as quad
  const quad = cropRectDisplay.map(p => ({ x: Math.max(0, Math.round(p.x * cropDrawScale)), y: Math.max(0, Math.round(p.y * cropDrawScale)) }));
  cropRects[croppingTarget] = { quad };
  // compute bounding box for info
  const xs = quad.map(p=>p.x), ys = quad.map(p=>p.y);
  const minx = Math.min(...xs), miny = Math.min(...ys), maxx = Math.max(...xs), maxy = Math.max(...ys);
  const sw = maxx - minx, sh = maxy - miny;
  if(croppingTarget === 1) cropInfo1.textContent = `Quad crop bounding box: ${sw}×${sh} at (${minx},${miny})`;
  else cropInfo2.textContent = `Quad crop bounding box: ${sw}×${sh} at (${minx},${miny})`;
  cropModal.classList.add('hidden');
});

cancelCropBtn.addEventListener('click', ()=>{ cropModal.classList.add('hidden'); });

cropBtn1.addEventListener('click', ()=>openCropModal(1));
cropBtn2.addEventListener('click', ()=>openCropModal(2));

clearBtn.addEventListener('click', ()=>{
  if(file1) file1.value = '';
  if(file2) file2.value = '';
  thumb1.src = '';
  thumb2.src = '';
  document.getElementById('preview1').src = '';
  document.getElementById('preview2').src = '';
  document.getElementById('preview1-container').style.display = 'none';
  document.getElementById('preview2-container').style.display = 'none';
  img1 = img2 = null;
  cropRects = {1:null,2:null};
  cropInfo1.textContent = '';
  cropInfo2.textContent = '';
  if(downloadPdfBtn) downloadPdfBtn.classList.add('hidden');
  const ctx = previewCanvas.getContext('2d');
  ctx && ctx.clearRect(0,0,previewCanvas.width, previewCanvas.height);
});

// format and quality controls removed from UI — use defaults in code above.

combineBtn.addEventListener('click', async ()=>{
  // If neither image provided, nothing to do
  if(!img1 && !img2){ alert('Please choose at least one image (Image 1 or Image 2).'); return; }

  setProgress(10);
  // ensure we have at least one image
  const imgs = [];
  if(img1) imgs.push({img: img1, crop: cropRects[1] || null});
  if(img2) imgs.push({img: img2, crop: cropRects[2] || null});
  if(imgs.length === 0){ alert('Please choose at least one image (Image 1 or Image 2).'); return; }

  const spacing = Number(spacingInput.value) || 0;
  const bg = bgcolorInput.value || '#ffffff';
  // Output width control removed: always use original/natural widths (requestedWidth = 0)
  const requestedWidth = 0;

  // determine target width
  const naturalWidths = imgs.map(o=>o.img.width).filter(Boolean);
  const maxNaturalWidth = Math.max(...naturalWidths);
  const targetWidth = requestedWidth > 0 ? requestedWidth : maxNaturalWidth;

  // function to compute scaled height given optional crop
  function scaledHeight(img, crop){
    if(!crop) return Math.round(img.height * (targetWidth / img.width));
    // if crop is quad, compute bounding box
    if(crop.quad){
      const xs = crop.quad.map(p=>p.x);
      const ys = crop.quad.map(p=>p.y);
      const srcW = Math.max(...xs) - Math.min(...xs);
      const srcH = Math.max(...ys) - Math.min(...ys);
      return Math.round(srcH * (targetWidth / srcW));
    }
    const srcW = crop.w || img.width;
    const srcH = crop.h || img.height;
    return Math.round(srcH * (targetWidth / srcW));
  }

  // Helper: compute affine transform that maps srcTri -> dstTri
  function getAffineTransform(srcTri, dstTri){
    // srcTri/dstTri: [{x,y},...]*3
    const m = [
      [srcTri[0].x, srcTri[0].y, 1],
      [srcTri[1].x, srcTri[1].y, 1],
      [srcTri[2].x, srcTri[2].y, 1]
    ];
    const inv = invert3(m);
    // multiply inv by dst x coords to get [a,c,e]
    const dx = [dstTri[0].x, dstTri[1].x, dstTri[2].x];
    const dy = [dstTri[0].y, dstTri[1].y, dstTri[2].y];
    const a = inv[0][0]*dx[0] + inv[0][1]*dx[1] + inv[0][2]*dx[2];
    const c = inv[1][0]*dx[0] + inv[1][1]*dx[1] + inv[1][2]*dx[2];
    const e = inv[2][0]*dx[0] + inv[2][1]*dx[1] + inv[2][2]*dx[2];
    const b = inv[0][0]*dy[0] + inv[0][1]*dy[1] + inv[0][2]*dy[2];
    const d = inv[1][0]*dy[0] + inv[1][1]*dy[1] + inv[1][2]*dy[2];
    const f = inv[2][0]*dy[0] + inv[2][1]*dy[1] + inv[2][2]*dy[2];
    return {a,b,c,d,e,f};
  }

  function invert3(mat){
    const a=mat[0][0], b=mat[0][1], c=mat[0][2];
    const d=mat[1][0], e=mat[1][1], f=mat[1][2];
    const g=mat[2][0], h=mat[2][1], i=mat[2][2];
    const A = e*i - f*h;
    const B = c*h - b*i;
    const C = b*f - c*e;
    const D = f*g - d*i;
    const E = a*i - c*g;
    const F = c*d - a*f;
    const G = d*h - e*g;
    const H = b*g - a*h;
    const I = a*e - b*d;
    const det = a*A + b*D + c*G;
    if(Math.abs(det) < 1e-8) return [[0,0,0],[0,0,0],[0,0,0]];
    const invDet = 1/det;
    return [ [A*invDet, B*invDet, C*invDet], [D*invDet, E*invDet, F*invDet], [G*invDet, H*invDet, I*invDet] ];
  }

  // PDF/PNG helpers removed: this build only supports JPEG export.

  // Draw image mapped from a source quad to destination rectangle (dx,dy,dw,dh)
  function drawImageQuad(ctx, img, srcQuad, dx, dy, dw, dh){
    // srcQuad: [{x,y}]*4 in image pixel coords
    // dstQuad is axis-aligned rectangle at dx,dy,dw,dh
    const dstQuad = [ {x:dx, y:dy}, {x:dx+dw, y:dy}, {x:dx+dw, y:dy+dh}, {x:dx, y:dy+dh} ];
    // split into two triangles: [0,1,2] and [0,2,3]
    const triangles = [ [0,1,2], [0,2,3] ];
    for(const triIdx of triangles){
      const sTri = triIdx.map(i=>({x: srcQuad[i].x, y: srcQuad[i].y}));
      const dTri = triIdx.map(i=>({x: dstQuad[i].x, y: dstQuad[i].y}));
      const t = getAffineTransform(sTri, dTri);
      ctx.save();
      // clip to destination triangle
      ctx.beginPath();
      ctx.moveTo(dTri[0].x, dTri[0].y);
      ctx.lineTo(dTri[1].x, dTri[1].y);
      ctx.lineTo(dTri[2].x, dTri[2].y);
      ctx.closePath();
      ctx.clip();
      // set transform to map source image coordinates to destination
      ctx.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }
  }

  // compute heights for each provided image and total canvas height
  const heights = imgs.map(o => scaledHeight(o.img, o.crop));
  const totalHeight = heights.reduce((a,b)=>a+b, 0) + Math.max(0, imgs.length-1) * spacing;

  previewCanvas.width = targetWidth;
  previewCanvas.height = totalHeight;
  const ctx = previewCanvas.getContext('2d');

  // fill background
  ctx.fillStyle = bg;
  ctx.fillRect(0,0,previewCanvas.width, previewCanvas.height);

  // draw each image in sequence (top -> bottom). Supports rectangular crop or quad
  let yOff = 0;
  for(let idx=0; idx<imgs.length; idx++){
    const item = imgs[idx];
    const h = heights[idx];
    const img = item.img;
    const crop = item.crop;
    if(crop){
      if(crop.quad && Array.isArray(crop.quad) && crop.quad.length===4){
        drawImageQuad(ctx, img, crop.quad, 0, yOff, targetWidth, h);
      } else {
        ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, yOff, targetWidth, h);
      }
    } else {
      ctx.drawImage(img, 0,0, img.width, img.height, 0, yOff, targetWidth, h);
    }
    yOff += h + spacing;
    // update progress a bit as we draw
    setProgress(60 + Math.round((idx+1)/Math.max(1, imgs.length) * 20));
  }

  setProgress(85);
  // Only JPEG export is supported; use default quality
  const fmt = 'image/jpeg';
  const quality = DEFAULT_QUALITY;
  previewCanvas.toBlob((blob)=>{
    if(!blob){ alert('Failed to generate image.'); setProgress(0); return; }
    // Show PDF download button
    if(downloadPdfBtn) downloadPdfBtn.classList.remove('hidden');
    // subtle preview animation
    try{ previewCanvas.classList.add('fade-in'); setTimeout(()=>previewCanvas.classList.remove('fade-in'), 700); }catch(e){}
    setProgress(100);
  }, fmt, quality);
});

// small UX: quality control removed — nothing to toggle here

// --- Post-combine adjustment controls ---
const adjBrightness = document.getElementById('adjBrightness');
const adjContrast = document.getElementById('adjContrast');
const adjSaturation = document.getElementById('adjSaturation');
const adjSharp = document.getElementById('adjSharp');
const adjBrightVal = document.getElementById('adjBrightVal');
const adjContrastVal = document.getElementById('adjContrastVal');
const adjSatVal = document.getElementById('adjSatVal');
const adjSharpVal = document.getElementById('adjSharpVal');
const applyAdjBtn = document.getElementById('applyAdj');
const downloadAdjPdf = document.getElementById('downloadAdjPdf');
const adjustedCanvas = document.getElementById('adjustedCanvas');

// filter controls
const filterSelect = document.getElementById('filterSelect');
const applyFilterBtn = document.getElementById('applyFilter');
const resetFilterBtn = document.getElementById('resetFilter');

// keep an offscreen copy of the adjusted (unfiltered) image so filters can be applied/reset
const baseAdjustedCanvas = document.createElement('canvas');
const baseAdjustedCtx = baseAdjustedCanvas.getContext('2d');

// reflect slider values
if(adjBrightness) adjBrightness.addEventListener('input', ()=>{ adjBrightVal.textContent = adjBrightness.value; updateAdjustedPreview(false); });
if(adjContrast) adjContrast.addEventListener('input', ()=>{ adjContrastVal.textContent = adjContrast.value; updateAdjustedPreview(false); });
if(adjSaturation) adjSaturation.addEventListener('input', ()=>{ adjSatVal.textContent = adjSaturation.value; updateAdjustedPreview(false); });
if(adjSharp) adjSharp.addEventListener('input', ()=>{ adjSharpVal.textContent = adjSharp.value; /* live preview without heavy sharpening */ updateAdjustedPreview(false); });
// when sharpness change is finished (mouse up / change), apply full sharpening and enable download
if(adjSharp) adjSharp.addEventListener('change', ()=>{ renderAdjusted(true); });

function applyConvolution(imageData, kernel, kernelSize){
  const w = imageData.width, h = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);
  const half = Math.floor(kernelSize/2);
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0;
      for(let ky=0; ky<kernelSize; ky++){
        for(let kx=0; kx<kernelSize; kx++){
          const ix = x + kx - half;
          const iy = y + ky - half;
          if(ix<0 || ix>=w || iy<0 || iy>=h) continue;
          const idx = (iy*w + ix)*4;
          const kval = kernel[ky*kernelSize + kx];
          r += src[idx] * kval;
          g += src[idx+1] * kval;
          b += src[idx+2] * kval;
        }
      }
      const di = (y*w + x)*4;
      out[di] = Math.min(255, Math.max(0, Math.round(r)));
      out[di+1] = Math.min(255, Math.max(0, Math.round(g)));
      out[di+2] = Math.min(255, Math.max(0, Math.round(b)));
      out[di+3] = src[di+3];
    }
  }
  return new ImageData(out, w, h);
}

// Render adjusted preview. If applySharpen true, perform convolution and create download link.
async function renderAdjusted(applySharpen){
  if(!previewCanvas.width || !previewCanvas.height){
    // No combined preview yet — instruct the user to combine first
    alert('No combined image to adjust. Please click "Combine" first to produce the combined image, then Apply Adjustments.');
    return;
  }
  const bright = adjBrightness ? Number(adjBrightness.value) : 100;
  const contrast = adjContrast ? Number(adjContrast.value) : 100;
  const sat = adjSaturation ? Number(adjSaturation.value) : 100;
  const sharp = adjSharp ? Number(adjSharp.value) : 0; // 0-100

  const t = document.createElement('canvas'); t.width = previewCanvas.width; t.height = previewCanvas.height;
  const tctx = t.getContext('2d');
  tctx.filter = `brightness(${bright}%) contrast(${contrast}%) saturate(${sat}%)`;
  tctx.drawImage(previewCanvas, 0, 0);

  const actx = adjustedCanvas.getContext('2d');
  adjustedCanvas.width = t.width; adjustedCanvas.height = t.height;

  if(applySharpen && sharp > 0){
    // full-resolution sharpening (may be slower)
    const p = Math.min(1, sharp/100);
    const k = [0, -p, 0, -p, 1+4*p, -p, 0, -p, 0];
    const id = tctx.getImageData(0,0,t.width,t.height);
    const out = applyConvolution(id, k, 3);
  actx.putImageData(out, 0, 0);
  try{ adjustedCanvas.classList.add('fade-in'); setTimeout(()=>adjustedCanvas.classList.remove('fade-in'), 700); }catch(e){}
    // copy to baseAdjusted (unfiltered) canvas
    baseAdjustedCanvas.width = adjustedCanvas.width;
    baseAdjustedCanvas.height = adjustedCanvas.height;
    baseAdjustedCtx.clearRect(0,0,baseAdjustedCanvas.width, baseAdjustedCanvas.height);
    baseAdjustedCtx.drawImage(adjustedCanvas, 0, 0);
    // create download link (JPEG only)
  const outQuality = DEFAULT_QUALITY;
    adjustedCanvas.toBlob((blob)=>{
      if(!blob) return;
      if(downloadAdjPdf) downloadAdjPdf.classList.remove('hidden');
    }, 'image/jpeg', outQuality);
  } else {
    // quick preview without expensive convolution
  actx.clearRect(0,0,adjustedCanvas.width, adjustedCanvas.height);
  actx.drawImage(t, 0, 0);
  try{ adjustedCanvas.classList.add('fade-in'); setTimeout(()=>adjustedCanvas.classList.remove('fade-in'), 600); }catch(e){}
    // copy preview to baseAdjusted so filters can be applied to preview too
    baseAdjustedCanvas.width = adjustedCanvas.width;
    baseAdjustedCanvas.height = adjustedCanvas.height;
    baseAdjustedCtx.clearRect(0,0,baseAdjustedCanvas.width, baseAdjustedCanvas.height);
    baseAdjustedCtx.drawImage(adjustedCanvas, 0, 0);
    if(applySharpen){
      // User requested Apply Adjustments but sharp === 0 — create a downloadable adjusted image (PDF)
  const outQuality = DEFAULT_QUALITY;
      adjustedCanvas.toBlob((blob)=>{
        if(!blob) return;
        if(downloadAdjPdf) downloadAdjPdf.classList.remove('hidden');
      }, 'image/jpeg', outQuality);
    } else {
      // normal live-preview path — hide download link until user explicitly applies adjustments
      if(downloadAdjPdf) downloadAdjPdf.classList.add('hidden');
    }
  }

  // After producing the base adjusted image, re-apply the currently-selected filter
  // in preview mode so filters update live when sliders change.
  // Use a small timeout to avoid blocking UI during rapid slider events.
  setTimeout(()=>{
    // apply filter in background; swallow any rejection (preview only)
    applyFilterToCanvas(true).catch(()=>{});
  }, 0);
}

// live preview update (no heavy sharpen)
function updateAdjustedPreview(){ renderAdjusted(false); }

applyAdjBtn && applyAdjBtn.addEventListener('click', ()=>{ renderAdjusted(true).catch(()=>{}); });

// Apply the selected filter to baseAdjustedCanvas and render to adjustedCanvas.
// If previewOnly is true, skip creating the downloadable blob.
async function applyFilterToCanvas(previewOnly = true){
  if(!baseAdjustedCanvas.width || !baseAdjustedCanvas.height) return;
  const type = (filterSelect && filterSelect.value) ? filterSelect.value : 'none';
  const w = baseAdjustedCanvas.width, h = baseAdjustedCanvas.height;
  const src = baseAdjustedCtx.getImageData(0,0,w,h);
  const data = src.data.slice(); // copy so we don't modify base

  const putResult = (outData) => {
    adjustedCanvas.width = w; adjustedCanvas.height = h;
    adjustedCanvas.getContext('2d').putImageData(outData, 0, 0);
    try{ adjustedCanvas.classList.add('fade-in'); setTimeout(()=>adjustedCanvas.classList.remove('fade-in'), 600); }catch(e){}
  };

  if(type === 'none'){
    const actx = adjustedCanvas.getContext('2d');
    adjustedCanvas.width = w; adjustedCanvas.height = h;
    actx.clearRect(0,0,w,h);
    actx.drawImage(baseAdjustedCanvas, 0, 0);
    try{ adjustedCanvas.classList.add('fade-in'); setTimeout(()=>adjustedCanvas.classList.remove('fade-in'), 600); }catch(e){}
  } else if(type === 'lighten'){
    for(let i=0;i<data.length;i+=4){
      data[i] = Math.min(255, Math.round(data[i]*1.08 + 12));
      data[i+1] = Math.min(255, Math.round(data[i+1]*1.08 + 12));
      data[i+2] = Math.min(255, Math.round(data[i+2]*1.08 + 12));
    }
    putResult(new ImageData(new Uint8ClampedArray(data), w, h));
  } else if(type === 'grayscale'){
    for(let i=0;i<data.length;i+=4){
      const r = data[i], g = data[i+1], b = data[i+2];
      const l = Math.round(0.299*r + 0.587*g + 0.114*b);
      data[i] = data[i+1] = data[i+2] = l;
    }
    putResult(new ImageData(new Uint8ClampedArray(data), w, h));
  } else if(type === 'document'){
    const contrastAmount = 60; // 0-255
    const f = (259*(contrastAmount+255)) / (255*(259-contrastAmount));
    for(let i=0;i<data.length;i+=4){
      const r = data[i], g = data[i+1], b = data[i+2];
      let l = Math.round(0.299*r + 0.587*g + 0.114*b);
      l = Math.round(f*(l - 128) + 128 + 8);
      l = Math.max(0, Math.min(255, l));
      data[i] = data[i+1] = data[i+2] = l;
    }
    putResult(new ImageData(new Uint8ClampedArray(data), w, h));
  }

  if(!previewOnly){
    // Show PDF download button
  const outQuality = DEFAULT_QUALITY;
    adjustedCanvas.toBlob((blob)=>{
      if(!blob) return;
      if(downloadAdjPdf) downloadAdjPdf.classList.remove('hidden');
    }, 'image/jpeg', outQuality);
  }
}

async function resetFilter(){
  if(!baseAdjustedCanvas.width || !baseAdjustedCanvas.height) return;
  adjustedCanvas.width = baseAdjustedCanvas.width; adjustedCanvas.height = baseAdjustedCanvas.height;
  adjustedCanvas.getContext('2d').clearRect(0,0,adjustedCanvas.width, adjustedCanvas.height);
  adjustedCanvas.getContext('2d').drawImage(baseAdjustedCanvas, 0, 0);
  try{ adjustedCanvas.classList.add('fade-in'); setTimeout(()=>adjustedCanvas.classList.remove('fade-in'), 600); }catch(e){}
  // recreate download link from baseAdjusted (JPEG)
  const outQuality = DEFAULT_QUALITY;
  adjustedCanvas.toBlob((blob)=>{
    if(!blob) return;
    if(downloadAdjPdf) downloadAdjPdf.classList.remove('hidden');
  }, 'image/jpeg', outQuality);
}

// wire filter selection to live preview
filterSelect && filterSelect.addEventListener('change', ()=>{ applyFilterToCanvas(true).catch(()=>{}); });
// keep Apply/Reset buttons functional
applyFilterBtn && applyFilterBtn.addEventListener('click', ()=>{ applyFilterToCanvas(false).catch(()=>{}); });
resetFilterBtn && resetFilterBtn.addEventListener('click', ()=>{ resetFilter().catch(()=>{}); });
// PDF Download functionality
const downloadPdfBtn = document.getElementById('downloadPdf');
let currentCanvasBlob = null;
let currentAdjustedCanvasBlob = null;

// Helper function to get jsPDF with retry
function getJsPDF() {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkLibrary = setInterval(() => {
      if (window.jspdf && window.jspdf.jsPDF) {
        clearInterval(checkLibrary);
        resolve(window.jspdf.jsPDF);
      } else if (attempts++ > 20) {
        clearInterval(checkLibrary);
        reject(new Error('jsPDF library failed to load'));
      }
    }, 100);
  });
}

// Store the combined canvas when it's created for PDF export
const originalToBlob = previewCanvas.toBlob;
previewCanvas.toBlob = function(callback, type, quality) {
  originalToBlob.call(this, (blob) => {
    if (type === 'image/jpeg') {
      currentCanvasBlob = blob;
    }
    callback(blob);
  }, type, quality);
};

// Store the adjusted canvas when it's created for PDF export
const originalAdjustedToBlob = adjustedCanvas.toBlob;
adjustedCanvas.toBlob = function(callback, type, quality) {
  originalAdjustedToBlob.call(this, (blob) => {
    if (type === 'image/jpeg') {
      currentAdjustedCanvasBlob = blob;
    }
    callback(blob);
  }, type, quality);
};

downloadPdfBtn && downloadPdfBtn.addEventListener('click', async ()=>{
  if (!currentCanvasBlob) {
    alert('Please generate combined image first.');
    return;
  }

  try {
    // Convert canvas directly to data URL for PDF
    const imgData = previewCanvas.toDataURL('image/jpeg', 0.95);
    
    // Get jsPDF library with retry
    const JsPDF = await getJsPDF();
    
    const pdf = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Get canvas dimensions and calculate scaling
    const canvasWidth = previewCanvas.width;
    const canvasHeight = previewCanvas.height;
    const ratio = canvasWidth / canvasHeight;
    
    // A4 dimensions in mm (with custom margins)
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    // Margins in millimeters (1 inch = 25.4mm)
    const marginTop = 15.4;      // 1"
    const marginBottom = 87;    // 5"
    const marginLeft = 56.2;     // 3"
    const marginRight = 56.2;    // 3"
    
    const maxWidth = pageWidth - marginLeft - marginRight;
    const maxHeight = pageHeight - marginTop - marginBottom;
    
    let imgWidth = maxWidth;
    let imgHeight = maxWidth / ratio;
    
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = maxHeight * ratio;
    }
    
    const x = marginLeft + ((maxWidth - imgWidth) / 2);
    const y = marginTop + ((maxHeight - imgHeight) / 2);
    
    pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
    pdf.save('combined.pdf');
  } catch(e) {
    alert('Error generating PDF: ' + e.message);
  }
});

// Adjusted image PDF download
downloadAdjPdf && downloadAdjPdf.addEventListener('click', async ()=>{
  if (!currentAdjustedCanvasBlob) {
    alert('Please apply adjustments first.');
    return;
  }

  try {
    // Convert canvas directly to data URL for PDF
    const imgData = adjustedCanvas.toDataURL('image/jpeg', 0.95);
    
    // Get jsPDF library with retry
    const JsPDF = await getJsPDF();
    
    const pdf = new JsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Get canvas dimensions and calculate scaling
    const canvasWidth = adjustedCanvas.width;
    const canvasHeight = adjustedCanvas.height;
    const ratio = canvasWidth / canvasHeight;
    
    // A4 dimensions in mm (with custom margins)
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    // Margins in millimeters (1 inch = 25.4mm)
    const marginTop = 15.4;      // 1"
    const marginBottom = 87;    // 5"
    const marginLeft = 56.2;     // 3"
    const marginRight = 56.2;    // 3"
    
    const maxWidth = pageWidth - marginLeft - marginRight;
    const maxHeight = pageHeight - marginTop - marginBottom;
    
    let imgWidth = maxWidth;
    let imgHeight = maxWidth / ratio;
    
    if (imgHeight > maxHeight) {
      imgHeight = maxHeight;
      imgWidth = maxHeight * ratio;
    }
    
    const x = marginLeft + ((maxWidth - imgWidth) / 2);
    const y = marginTop + ((maxHeight - imgHeight) / 2);
    
    pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
    pdf.save('combined_adjusted.pdf');
  } catch(e) {
    alert('Error generating PDF: ' + e.message);
  }
});