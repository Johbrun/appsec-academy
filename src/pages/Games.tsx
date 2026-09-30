import { Link, useSearchParams } from 'react-router-dom';
import { Block, Difficulty, Icon, Orb, PageHead } from '../components/ui';
import { useProgress } from '../store/progress';
import { availableGames, gameCategories, games, type GameCategoryId, type GameMeta } from '../data/games';
import { moduleById, pad2 } from '../data/catalog';

const moduleLabel = (ids: string[]) =>
  ids.length ? ids.map((id) => `M${pad2(moduleById(id)?.num ?? 0)}`).join(' · ') : 'Tous les modules';

function GameCard({ game, score }: { game: GameMeta; score?: number }) {
  return (
    <Link to={`/jeux/${game.id}`} className="bento-card span-4 hud game-card">
      <div className="bento-top">
        <Orb palette={game.palette} className="game-orb fine" />
        <Difficulty level={game.level} />
      </div>
      <div className="bento-text">
        <span className="label">{moduleLabel(game.modules)}</span>
        <h3 style={{ marginTop: 8 }}>{game.title}</h3>
        <p className="dim">{game.text}</p>
      </div>
      <div className="game-foot">
        <span className="label">{game.time} · {game.xp} XP max</span>
        {score !== undefined
          ? <span className="label ink"><span className="led" style={{ display: 'inline-block', marginRight: 6 }} />Record {score}%</span>
          : <span className="label">Pas encore joué</span>}
      </div>
    </Link>
  );
}

export default function Games() {
  const { progress } = useProgress();
  const [params, setParams] = useSearchParams();

  const selected = gameCategories.find((c) => c.id === params.get('c'))?.id ?? null;
  const shown = selected ? gameCategories.filter((c) => c.id === selected) : gameCategories;

  const played = availableGames.filter((g) => g.id in progress.scores);
  const upcoming = games.filter((g) => !g.available);

  const pick = (id: GameCategoryId | null) => {
    if (id) setParams({ c: id });
    else setParams({});
  };

  return (
    <>
      <PageHead eyebrow="Pratique" title="Jeux pédagogiques"
        aside={(
          <div className="row" style={{ gap: 28, marginTop: 24 }}>
            <div><span className="label">Joués</span><div className="big-num" style={{ fontSize: '2.25rem' }}>{played.length}<span className="dim" style={{ fontSize: '1.25rem' }}>/{availableGames.length}</span></div></div>
            <div><span className="label">Catégories</span><div className="big-num" style={{ fontSize: '2.25rem' }}>{gameCategories.length}</div></div>
          </div>
        )}>
        Chaque jeu reproduit un geste du métier, et c’est par le geste qu’ils sont rangés — pas par module.
        Ton meilleur score est conservé, et chaque amélioration rapporte de l’XP.
      </PageHead>

      <Block className="tight">
        <div className="cat-rail">
          <button className={`cat-chip ${selected ? '' : 'on'}`} onClick={() => pick(null)}>
            Tout <span className="meta">{availableGames.length}</span>
          </button>
          {gameCategories.map((c) => {
            const list = availableGames.filter((g) => g.category === c.id);
            const done = list.filter((g) => g.id in progress.scores).length;
            return (
              <button key={c.id} className={`cat-chip ${selected === c.id ? 'on' : ''}`} onClick={() => pick(c.id)}>
                <Orb palette={c.palette} xs />
                {c.short}
                <span className="meta">{done}/{list.length}</span>
              </button>
            );
          })}
        </div>
      </Block>

      {shown.map((c) => {
        const list = availableGames.filter((g) => g.category === c.id);
        if (!list.length) return null;
        const done = list.filter((g) => g.id in progress.scores).length;
        return (
          <Block key={c.id}
            eyebrow={<span className="cat-eyebrow"><Icon name={c.icon} size={14} />{done}/{list.length} joués</span>}
            title={c.title}
            lead={c.text}>
            <div className="bento">
              {list.map((g) => <GameCard key={g.id} game={g} score={progress.scores[g.id]} />)}
            </div>
          </Block>
        );
      })}

      {upcoming.length > 0 && (
        <Block eyebrow="À venir" title="La suite du catalogue" lead="Ces jeux arrivent avec les modules correspondants.">
          <div className="grid g3">
            {upcoming.map((g) => (
              <div key={g.id} className="card upcoming">
                <div className="row between">
                  <span className="tile"><Icon name={g.icon} size={17} /></span>
                  <Difficulty level={g.level} label={false} />
                </div>
                <div>
                  <span className="label">{moduleLabel(g.modules)}</span>
                  <h3>{g.title}</h3>
                  <p className="dim small">{g.text}</p>
                </div>
              </div>
            ))}
          </div>
        </Block>
      )}
    </>
  );
}
