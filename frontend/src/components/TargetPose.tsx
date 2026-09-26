export function TargetPose({ title, illustrationUrl }: { title: string; illustrationUrl?: string }) {
  return (
    <figure className="target-card">
      {illustrationUrl ? (
        <img src={illustrationUrl} alt="" />
      ) : (
        <div className="target-fallback">Нет картинки</div>
      )}
      <figcaption>{title}</figcaption>
    </figure>
  );
}
