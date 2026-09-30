import { Link } from 'react-router-dom';
import { Block } from '../components/ui';

export default function NotFound() {
  return (
    <Block eyebrow="404" title="Page introuvable" lead="Cette adresse ne correspond à aucune page du parcours.">
      <Link to="/" className="btn primary">Retour à l’accueil</Link>
    </Block>
  );
}
