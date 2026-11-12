// A consumer's own worker file that pulls the decode worker in by side-effect import.
// Bundlers drop such an import unless the package marks the file as having side effects.
import '@khawkins98/scriptoscope/decode-worker';
