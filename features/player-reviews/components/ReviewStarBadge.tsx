"use client";

interface ReviewStarBadgeProps {
  average: number;
  total: number;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
}

export function ReviewStarBadge({
  average,
  total,
  onClick,
  size = "md",
}: ReviewStarBadgeProps) {
  const sizeClasses = {
    sm: {
      container: "text-xs gap-1 px-2 py-0.5",
      star: "text-sm",
      text: "text-xs",
    },
    md: {
      container: "text-base gap-1.5 px-3 py-1",
      star: "text-xl",
      text: "text-base font-semibold",
    },
    lg: {
      container: "text-lg gap-2 px-4 py-2",
      star: "text-2xl",
      text: "text-lg font-bold",
    },
  };

  const classes = sizeClasses[size];

  return (
    <button
      onClick={onClick}
      className={`flex items-center ${classes.container} rounded-full
                 bg-gray-800 border border-gray-600 hover:border-yellow-400
                 text-gray-300 hover:text-yellow-400 transition-all group`}
      title={`${total} review${total !== 1 ? "s" : ""} - Tap to rate`}
    >
      <span
        className={`text-yellow-400 ${classes.star} group-hover:scale-110 transition-transform`}
      >
        ★
      </span>
      {total > 0 ? (
        <>
          <span className={classes.text}>{average.toFixed(1)}</span>
          <span className="text-xs text-gray-500 group-hover:text-yellow-400 ml-1">
            tap to rate
          </span>
        </>
      ) : (
        <span className={`${classes.text} italic`}>Rate</span>
      )}
    </button>
  );
}
