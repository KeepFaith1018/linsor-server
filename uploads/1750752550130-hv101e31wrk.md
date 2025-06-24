# nest 后端CICD

### 创建用户

```bash
# 1. 创建用户
sudo adduser deployer

# 2. 设置密码（你也可以不设置密码，仅使用 SSH 登录）
sudo passwd deployer (pass:linsor)
```



### 创建生成ssh密钥

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions@linsor" -f ~/.ssh/id_rsa_linsor_ci （指定生成名称）
```

~/.ssh/id_rsa_linsor_ci	私钥，需上传到 GitHub Secrets

~/.ssh/id_rsa_linsor_ci.pub	公钥，需添加到服务器的 authorized_keys



### 复制密钥到用户目录

复制公钥`~/.ssh/id_rsa_linsor_ci.pub` 到 用户 `~/.ssh/authorized_keys` 。

使用私钥可以登录用户的空间。

```bash
mkdir -p /home/deployer/.ssh
echo "你的公钥内容" >> /home/deployer/.ssh/authorized_keys
chmod 600 /home/deployer/.ssh/authorized_keys
chown -R deployer:deployer /home/deployer/.ssh
```





### 配置github CICD的变量

进入你的 GitHub 仓库：

**Settings → Secrets and variables → Actions → New repository secret**

添加以下 4 个 Secret：

**Secret 名称**	**示例值**	**说明**

ALIYUN_HOST	39.100.xx.xx	你的阿里云公网 IP

ALIYUN_PORT	22	默认 22（如自定义请写真实值）

ALIYUN_USERNAME	deployer	安全用户的用户名

ALIYUN_SSH_KEY	-----BEGIN RSA PRIVATE KEY----- ...	**你本地生成的私钥内容**（多行一起复制进去）