def calculate_next_soc(I_current, dt, capacity, current_SOC, coulombic_efficiency, SOH):
    effective_capacity_As = capacity * SOH * 3600

    if I_current < 0:
        next_SOC = current_SOC - (I_current * dt / effective_capacity_As) * coulombic_efficiency
    else:
        next_SOC = current_SOC - (I_current * dt / effective_capacity_As)

    next_SOC = max(0.0, min(1.0, next_SOC))

    return next_SOC