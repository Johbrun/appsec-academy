// Les grammaires de prismjs s'enregistrent sur un Prism global : on expose celui de prism-react-renderer.
import { Prism } from 'prism-react-renderer';

(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism;
