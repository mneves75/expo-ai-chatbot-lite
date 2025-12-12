package expo.modules.luminapdfrenderer

import android.content.ContentResolver
import android.content.Context
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class ExpoLuminaPdfRendererModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoLuminaPdfRenderer")

    AsyncFunction("renderPdfPagesToPngs") { pdfUri: String, options: Map<String, Any>? ->
      val ctx = appContext.reactContext ?: throw Exception("Missing React context")
      renderPdfPagesToPngs(ctx, pdfUri, options ?: emptyMap())
    }

    AsyncFunction("extractPdfText") { pdfUri: String ->
      val ctx = appContext.reactContext ?: throw Exception("Missing React context")
      extractPdfText(ctx, pdfUri)
    }
  }

  private fun extractPdfText(context: Context, pdfUri: String): Map<String, Any> {
    // Android's PdfRenderer does not expose a text extraction API. We return the pageCount
    // (useful for heuristics) and an empty string; callers can fall back to OCR when needed.
    val uri = Uri.parse(pdfUri)
    val pfd = openParcelFileDescriptor(context.contentResolver, uri)
      ?: throw Exception("Unable to open PDF: $pdfUri")

    var pageCount = 0
    PdfRenderer(pfd).use { renderer ->
      pageCount = renderer.pageCount
    }

    pfd.close()
    return mapOf(
      "text" to "",
      "pageCount" to pageCount
    )
  }

  private fun renderPdfPagesToPngs(context: Context, pdfUri: String, options: Map<String, Any>): List<String> {
    val scale = (options["scale"] as? Double ?: 2.0).toFloat()
    val maxPages = (options["maxPages"] as? Double ?: 200.0).toInt()

    val uri = Uri.parse(pdfUri)
    val pfd = openParcelFileDescriptor(context.contentResolver, uri)
      ?: throw Exception("Unable to open PDF: $pdfUri")

    val outDir = File(context.cacheDir, "lumina-pdf-pages")
    if (!outDir.exists()) outDir.mkdirs()

    val results = mutableListOf<String>()

    PdfRenderer(pfd).use { renderer ->
      val pageCount = minOf(renderer.pageCount, maxPages)
      for (i in 0 until pageCount) {
        renderer.openPage(i).use { page ->
          val width = (page.width * scale).toInt().coerceAtLeast(1)
          val height = (page.height * scale).toInt().coerceAtLeast(1)
          val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
          bitmap.eraseColor(0xFFFFFFFF.toInt())
          page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

          val file = File(outDir, "page-${i + 1}.png")
          FileOutputStream(file).use { fos ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos)
          }
          bitmap.recycle()
          results.add(Uri.fromFile(file).toString())
        }
      }
    }

    pfd.close()
    return results
  }

  private fun openParcelFileDescriptor(resolver: ContentResolver, uri: Uri): ParcelFileDescriptor? {
    return resolver.openFileDescriptor(uri, "r")
  }
}
