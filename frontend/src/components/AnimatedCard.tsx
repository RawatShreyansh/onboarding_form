'use client'

import { motion } from 'framer-motion'
import { ReactNode } from 'react'
import clsx from 'clsx'

interface AnimatedCardProps {
  children: ReactNode
  className?: string
  delay?: number
  onClick?: () => void
}

export function AnimatedCard({ children, className, delay = 0, onClick }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={onClick ? { scale: 1.02, y: -4 } : { y: -2 }}
      onClick={onClick}
      className={clsx(
        'bg-surface border border-outline-variant rounded-xl shadow-sm overflow-hidden',
        onClick && 'cursor-pointer transition-shadow hover:shadow-md',
        className
      )}
    >
      {children}
    </motion.div>
  )
}
