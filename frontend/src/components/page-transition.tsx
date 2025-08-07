import { motion, AnimatePresence } from "motion/react";
import { type ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  isLoading?: boolean;
}

// Enhanced page transition variants with smoother animations
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.96,
    filter: "blur(4px)",
  },
  in: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
  },
  out: {
    opacity: 0,
    y: -20,
    scale: 1.04,
    filter: "blur(2px)",
  },
};

// Smooth spring transition with better feel
const pageTransition = {
  type: "spring" as const,
  stiffness: 300,
  damping: 25,
  mass: 0.6,
  duration: 0.4,
};

// Enhanced loading state variants with backdrop blur
const loadingVariants = {
  initial: { 
    opacity: 0,
    scale: 0.8,
    backdropFilter: "blur(0px)",
  },
  animate: { 
    opacity: 1,
    scale: 1,
    backdropFilter: "blur(8px)",
  },
  exit: { 
    opacity: 0,
    scale: 0.8,
    backdropFilter: "blur(0px)",
  },
};

// Smoother loading transition
const loadingTransition = {
  type: "spring" as const,
  stiffness: 260,
  damping: 20,
  duration: 0.5,
};

// Enhanced spinner animation variants with pulse effect
const spinnerVariants = {
  animate: {
    rotate: 360,
    scale: [1, 1.05, 1],
  },
};

const counterSpinnerVariants = {
  animate: {
    rotate: -360,
    opacity: [0.6, 1, 0.6],
  },
};

const spinnerTransition = {
  rotate: {
    duration: 1.2,
    repeat: Infinity,
    ease: "linear" as const,
  },
  scale: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

const counterSpinnerTransition = {
  rotate: {
    duration: 1.8,
    repeat: Infinity,
    ease: "linear" as const,
  },
  opacity: {
    duration: 1.5,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

// Text fade-in animation
const textVariants = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
};

const textTransition = {
  delay: 0.15,
  duration: 0.4,
  ease: "easeOut" as const,
};

export function PageTransition({ children, isLoading = false }: PageTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {isLoading ? (
        <motion.div
          key="loading"
          variants={loadingVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={loadingTransition}
          className="flex h-screen w-full items-center justify-center bg-background"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.1
            }}
            className="flex flex-col items-center gap-8"
          >
            <div className="relative">
              {/* Outer glow ring */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -inset-2 rounded-full bg-primary/10 blur-sm"
              />
              
              {/* Main spinner */}
              <motion.div
                variants={spinnerVariants}
                animate="animate"
                transition={spinnerTransition}
                className="h-12 w-12 rounded-full border-3 border-muted border-t-primary border-r-primary/70 shadow-lg"
              />
              
              {/* Inner counter-rotating element */}
              <motion.div
                variants={counterSpinnerVariants}
                animate="animate"
                transition={counterSpinnerTransition}
                className="absolute inset-2 h-8 w-8 rounded-full border-2 border-transparent border-b-primary/40 border-l-primary/40"
              />
              
              {/* Center dot */}
              <motion.div
                animate={{
                  scale: [1, 0.8, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-primary"
              />
            </div>
            
            {/* Animated loading text with dots */}
            <motion.div
              variants={textVariants}
              initial="initial"
              animate="animate"
              transition={textTransition}
              className="flex items-center gap-1 text-sm text-muted-foreground font-medium"
            >
              <span>Loading</span>
              <motion.span
                animate={{
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: 0,
                }}
              >
                .
              </motion.span>
              <motion.span
                animate={{
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: 0.2,
                }}
              >
                .
              </motion.span>
              <motion.span
                animate={{
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: 0.4,
                }}
              >
                .
              </motion.span>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial="initial"
          animate="in"
          exit="out"
          variants={pageVariants}
          transition={pageTransition}
          className="h-full w-full"
          // Optimize for 60fps
          style={{ willChange: "transform, opacity" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RouteTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="h-full w-full"
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}