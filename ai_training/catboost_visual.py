import pandas as pd
import matplotlib.pyplot as plt

learn_log = pd.read_csv("catboost_info/learn_error.tsv", sep="\t")
test_log  = pd.read_csv("catboost_info/test_error.tsv", sep="\t")


print(learn_log.head())
print(test_log.head())


plt.figure(figsize=(10, 6))

plt.plot(
    learn_log["iter"],
    learn_log.iloc[:, 1],
    label="Training Error"
)

plt.plot(
    test_log["iter"],
    test_log.iloc[:, 1],
    label="Validation Error"
)

plt.xlabel("Iteration")
plt.ylabel("Error")
plt.title("CatBoost Learning Curve")
plt.legend()
plt.tight_layout()
plt.show()
