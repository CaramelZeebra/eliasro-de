import Connect4 from './Connect4';

// Astro cannot serialise a function prop across the island boundary, so the
// close handler is supplied here. Closing the board leaves the room.
export default function Connect4Page({ buildTime }: { buildTime?: string }) {
  return (
    <Connect4
      onClose={() => {
        window.location.href = '/';
      }}
      buildTime={buildTime}
    />
  );
}
