import styles from "./loading.module.css";

// Simple skeleton, not a giant centered spinner (section 25). Respects prefers-reduced-motion
// via the shared shimmer keyframe rule in loading.module.css.
export default function HomeLoading() {
  return (
    <div className={styles.page} aria-hidden="true">
      <div className={styles.heroSkeleton} />
      <div className={styles.grid}>
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className={styles.card} />
        ))}
      </div>
    </div>
  );
}
