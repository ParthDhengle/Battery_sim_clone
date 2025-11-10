import numpy as np

def calculate_reversible_heat(temp_K, I_current, next_SOC):
    x_pos_0 = 0.2567
    x_pos_100 = 0.9072
    x_neg_0 = 0.0279
    x_neg_100 = 0.9014

    a0_n = -0.1112
    a1_n = 0
    a2_n = 0.3561
    b1_n = 0.4955
    b2_n = 0.08309
    c0_n = 0.02914
    c1_n = 0.1122
    c2_n = 0.004616
    d1_n = 63.9

    a1_p = 0.04006
    a2_p = -0.06656
    b1_p = 0.2828
    b2_p = 0.8032
    c1_p = 0.0009855
    c2_p = 0.02179

    next_SOC = max(0.0, min(1.0, next_SOC))

    x_pos = next_SOC * (x_pos_100 - x_pos_0) + x_pos_0
    x_neg = next_SOC * (x_neg_100 - x_neg_0) + x_neg_0

    du_dt_pos = (
        a1_p * np.exp(-((x_pos - b1_p) ** 2) / c1_p)
        + a2_p * np.exp(-((x_pos - b2_p) ** 2) / c2_p)
    ) / 1000.0

    du_dt_neg = (
        a0_n * x_neg + c0_n
        + a2_n * np.exp(-((x_neg - b2_n) ** 2) / c2_n)
        + a1_n * (np.tanh(d1_n * (x_neg - (b1_n - c1_n))) - np.tanh(d1_n * (x_neg - (b1_n + c1_n))))
    ) / 1000.0

    du_dt = du_dt_pos - du_dt_neg

    q_rev = temp_K * (-I_current) * du_dt

    return q_rev