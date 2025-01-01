import React from 'react';

interface RotatingImageLoaderProps {
  src: string;
  alt?: string;
  size?: 'small' | 'default' | 'large';
  className?: string;
}

const RotatingImageLoader: React.FC<RotatingImageLoaderProps> = ({
  src,
  alt = 'Loading...',
  size = 'default',
  className = ''
}) => {
  // Map size prop to actual dimensions
  const sizeClasses = {
    small: 'w-12 h-12',
    default: 'w-20 h-20',
    large: 'w-32 h-32'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <img
        src={src}
        alt={alt}
        className={`${sizeClasses[size]} animate-spin`}
        style={{
          animationDuration: '1s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite'
        }}
      />
    </div>
  );
};

export default RotatingImageLoader;