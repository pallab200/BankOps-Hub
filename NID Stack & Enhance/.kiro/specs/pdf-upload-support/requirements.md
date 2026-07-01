# Requirements Document

## Introduction

This feature extends the NID Stack & Enhance application to accept PDF files in addition to the currently supported image formats (JPEG, PNG, WebP, GIF). When a user uploads a PDF file to either the front or back NID slot, the application renders the first page of the PDF as an image using the bundled pdf.js library and feeds the resulting image into the existing crop → combine → adjust → filter → export pipeline. The application continues to work fully offline from the filesystem.

## Glossary

- **Upload_Controller**: The controller module responsible for handling file selection (click) and drag-and-drop events, validating files, decoding them, and rendering previews and thumbnails.
- **Validation_Module**: The pure validation module (`validation.js`) that checks file type and size constraints before processing.
- **PDF_Renderer**: The component that uses the pdf.js library to load a PDF file and render its first page to a canvas, producing an image data URL.
- **SUPPORTED_TYPES**: The array of accepted MIME types used by the Validation_Module to determine if a file is allowed.
- **Upload_Slot**: One of the two file input positions (front or back) where a user can provide an NID image or PDF.
- **Rendered_Image**: The image produced by converting the first page of a PDF document into a raster image via canvas rendering.
- **pdf.js**: The bundled PDF rendering library (`libs/pdf.min.js`) already available in the application.

## Requirements

### Requirement 1: Accept PDF File Type

**User Story:** As a user, I want to upload PDF files to the NID slots, so that I can use scanned NID documents saved as PDFs.

#### Acceptance Criteria

1. THE Validation_Module SHALL include "application/pdf" in the SUPPORTED_TYPES array alongside the existing image types (image/jpeg, image/png, image/webp, image/gif).
2. WHEN a PDF file of size less than or equal to 10 MB is selected or dropped, THE Validation_Module SHALL return a validation result indicating success (ok: true).
3. IF a PDF file exceeding the maximum allowed size of 10 MB is selected or dropped, THEN THE Validation_Module SHALL reject the file with a validation result indicating failure with reason "size".
4. IF a file with an unsupported MIME type is selected or dropped, THEN THE Validation_Module SHALL reject the file with a validation result indicating failure with reason "type" and a message that lists all supported formats including PDF.

### Requirement 2: Update File Input Accept Attribute

**User Story:** As a user, I want the file picker dialog to show PDF files as selectable, so that I can easily find and choose PDF documents.

#### Acceptance Criteria

1. THE Upload_Controller SHALL configure each Upload_Slot file input element's `accept` attribute to the value "image/jpeg,image/png,image/webp,image/gif,application/pdf" before user interaction is possible.
2. WHEN a user opens the file picker via click on either Upload_Slot, THE file picker dialog SHALL display PDF files (.pdf) as selectable options alongside the supported image types.
3. WHEN a PDF file is dropped onto an Upload_Slot, THE Upload_Controller SHALL accept the file for processing regardless of the file input `accept` attribute (since drag-and-drop bypasses the accept filter).

### Requirement 3: Render PDF First Page as Image

**User Story:** As a user, I want the first page of my uploaded PDF to be automatically converted to an image, so that it can be used in the existing image processing pipeline.

#### Acceptance Criteria

1. WHEN a valid PDF file is uploaded to an Upload_Slot, THE PDF_Renderer SHALL read the file as an ArrayBuffer and load the PDF document using the pdf.js library.
2. WHEN the PDF document is loaded, THE PDF_Renderer SHALL render the first page of the document to an offscreen canvas element.
3. WHEN rendering the first page, THE PDF_Renderer SHALL use a scale factor of 2.0 or the page's default viewport scale, whichever is larger, to produce the Rendered_Image at a minimum 150 DPI equivalent resolution.
4. WHEN the first page is rendered, THE PDF_Renderer SHALL convert the canvas content to a PNG data URL (starting with "data:image/png;base64,") to produce the Rendered_Image.
5. THE PDF_Renderer SHALL produce a Rendered_Image as a PNG data URL with positive integer naturalWidth and naturalHeight values, such that it can be passed to appState.setSource and displayed in preview and thumbnail elements identically to a directly uploaded image.
6. IF the rendered canvas would exceed 4096 pixels in either dimension, THEN THE PDF_Renderer SHALL scale down proportionally so that neither dimension exceeds 4096 pixels.

### Requirement 4: PDF Upload Progress Feedback

**User Story:** As a user, I want to see progress feedback while my PDF is being processed, so that I know the application is working on converting the document.

#### Acceptance Criteria

1. WHEN a PDF file passes validation, THE Upload_Controller SHALL display the progress indicator at 0% before starting PDF rendering.
2. WHILE the PDF_Renderer is processing the document, THE Upload_Controller SHALL keep the progress indicator visible, and the displayed progress value SHALL be non-decreasing (never move backward) within a single operation.
3. WHEN the PDF_Renderer completes rendering successfully, THE Upload_Controller SHALL set the progress indicator to 100% and then hide it within 1000 milliseconds.
4. IF the PDF_Renderer encounters an error during loading or rendering, THEN THE Upload_Controller SHALL display an error message indicating the nature of the failure (e.g., could not load, could not render) and hide the progress indicator within 1000 milliseconds.
5. WHILE the progress indicator is visible, THE Upload_Controller SHALL reflect the current percentage value via an accessible attribute (aria-valuenow) on the progress element.

### Requirement 5: PDF Error Handling

**User Story:** As a user, I want clear error messages when a PDF cannot be processed, so that I understand what went wrong and can try a different file.

#### Acceptance Criteria

1. IF the pdf.js library fails to load the PDF document (corrupted file, encrypted PDF, or unsupported PDF version), THEN THE Upload_Controller SHALL display an error message via the ARIA live region indicating that the PDF could not be loaded, distinct from the rendering error in criterion 3.
2. IF the PDF document contains zero pages, THEN THE Upload_Controller SHALL display an error message via the ARIA live region indicating that the PDF has no renderable pages.
3. IF the canvas rendering of the first page fails, THEN THE Upload_Controller SHALL display an error message via the ARIA live region indicating that the PDF page could not be rendered, distinct from the loading error in criterion 1.
4. WHEN a PDF processing error occurs, THE Upload_Controller SHALL leave the Upload_Slot in its previous state without modifying the preview image, thumbnail image, or application state for that slot.
5. WHEN a PDF processing error occurs, THE Upload_Controller SHALL hide the progress indicator within 1000 milliseconds of the error.

### Requirement 6: Consistent Upload Behavior for PDF and Images

**User Story:** As a user, I want PDF uploads to work the same way as image uploads (via click or drag-and-drop), so that the experience is seamless regardless of file type.

#### Acceptance Criteria

1. WHEN a PDF file is dropped onto an Upload_Slot, THE Upload_Controller SHALL process the PDF through the same load routine as a PDF file selected via click, producing identical state mutations, preview rendering, and thumbnail rendering regardless of entry path.
2. WHEN PDF rendering completes, THE Upload_Controller SHALL display the Rendered_Image in the in-card preview by setting the preview image source to the Rendered_Image data URL and making the preview container visible, matching the behavior for a directly uploaded image.
3. WHEN PDF rendering completes, THE Upload_Controller SHALL display the Rendered_Image in the Input Images thumbnail by setting the thumbnail image source to the Rendered_Image data URL, making the thumbnail element visible, and hiding the placeholder element, matching the behavior for a directly uploaded image.
4. WHEN PDF rendering completes, THE Upload_Controller SHALL store the Rendered_Image pixel width and pixel height as the naturalWidth and naturalHeight of the Upload_Slot in the application state, matching the format used for directly uploaded image dimensions.
5. WHEN a new PDF file is successfully rendered, THE Upload_Controller SHALL set the crop data for that Upload_Slot to null in the application state, consistent with the behavior when a new image is uploaded.

### Requirement 7: Multi-Page PDF Handling

**User Story:** As a user, I want to know that only the first page of a multi-page PDF is used, so that I can prepare my documents accordingly.

#### Acceptance Criteria

1. WHEN a PDF with 2 or more pages is uploaded to an Upload_Slot, THE PDF_Renderer SHALL request and render only page 1 from the pdf.js library and SHALL NOT load or render any subsequent pages.
2. WHEN a multi-page PDF is successfully processed, THE Upload_Controller SHALL produce the same preview image, thumbnail image, and application state entries as a single-page PDF whose single page is identical to the multi-page PDF's first page, with no additional warnings, messages, or metadata indicating that extra pages exist.
3. WHEN a multi-page PDF is successfully processed, THE Upload_Controller SHALL NOT store the source PDF's total page count or any per-page metadata for pages beyond page 1 in the application state.
